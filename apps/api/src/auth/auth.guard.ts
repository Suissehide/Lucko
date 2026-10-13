import { PARENTAL_CONSENT_REQUIRED } from '@lucko/shared'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { needsParentalConsent } from '../common/minors.rules'
import type { UserRole, VenueStaffRole } from '../generated/prisma/client'
import { ALLOW_PENDING_CONSENT, IS_PUBLIC, ROLES, VENUE_ROLES } from './auth.decorators'
import { type AuthRequest, AuthService } from './auth.service'

/**
 * Guard global : toute route exige un utilisateur connecté, sauf `@Public()`,
 * un 13-14 ans sans accord parental en lecture seule sauf `@AllowPendingConsent()`,
 * `@Roles(...)` restreint aux rôles globaux listés, `@VenueRoles(...)` au staff du lieu `:venueId`.
 * Les règles qui dépendent de la ressource (mineurs, hôte d'une room) restent dans les services.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    // Temps réel : la session est lue à la connexion, la passerelle vérifie chaque abonnement
    if (context.getType() !== 'http') return true
    const targets = [context.getHandler(), context.getClass()]
    const request = context.switchToHttp().getRequest<AuthRequest>()
    const user = await this.auth.resolveUser(request.headers)
    // Route publique : l'utilisateur est quand même posé s'il est connecté (ex. « inscrit » sur une fiche)
    if (user) request.user = user
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true
    if (!user) throw new UnauthorizedException('Connexion requise')

    // 13-14 ans sans accord parental : lecture seule (LKO-49)
    if (
      request.method !== 'GET' &&
      needsParentalConsent(user) &&
      !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_CONSENT, targets)
    )
      throw new ForbiddenException({
        code: PARENTAL_CONSENT_REQUIRED,
        message: 'Un parent doit d’abord valider ton compte',
      })

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, targets)
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException('Accès refusé')

    const venueRoles = this.reflector.getAllAndOverride<VenueStaffRole[] | undefined>(
      VENUE_ROLES,
      targets,
    )
    if (venueRoles?.length && user.role !== 'ADMIN') {
      const venueId = request.params?.venueId
      if (typeof venueId !== 'string')
        throw new Error('@VenueRoles exige un paramètre :venueId dans la route')
      const role = await this.auth.venueRole(user.id, venueId)
      if (!role || !venueRoles.includes(role))
        throw new ForbiddenException('Réservé au staff du lieu')
    }
    return true
  }
}
