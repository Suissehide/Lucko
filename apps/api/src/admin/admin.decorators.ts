import type { AdminActionKind } from '@lucko/shared'
import {
  applyDecorators,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { concatMap } from 'rxjs'
import { Roles } from '../auth/auth.decorators'
import type { AuthRequest } from '../auth/auth.service'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const AUDIT = 'adminAudit'

/** Action tracée : fixe, ou déduite du corps de la requête (issue d'un signalement). */
export type AuditKind = AdminActionKind | ((body: Record<string, unknown>) => AdminActionKind)

/**
 * Écrit l'action dans le journal d'audit une fois la route réussie : admin connecté, `:id` de la route
 * (ou l'`id` créé) comme cible, motif et corps de la requête.
 */
// ponytail: écrit après l'action, hors de sa transaction ; passer l'audit dans chaque transaction si une trace manque un jour
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const kind = this.reflector.get<AuditKind | undefined>(AUDIT, context.getHandler())
    const request = context.switchToHttp().getRequest<AuthRequest>()
    return next.handle().pipe(
      concatMap(async (result) => {
        if (!kind || !request.user) return result
        const body = (request.body ?? {}) as Record<string, unknown>
        await this.prisma.adminAction.create({
          data: {
            adminId: request.user.id,
            action: typeof kind === 'function' ? kind(body) : kind,
            // Création : pas de `:id` dans la route, la cible est ce qui vient d'être créé
            targetId: String(request.params.id ?? (result as { id?: string } | null)?.id ?? ''),
            reason: typeof body.reason === 'string' ? body.reason : '',
            data: body as Prisma.InputJsonObject,
          },
        })
        return result
      }),
    )
  }
}

/**
 * Route du back-office (LKO-20) : réservée aux admins (403 sinon) ; avec `action`, tracée dans le journal
 * d'audit. Toute route qui modifie quelque chose en a une (vérifié par admin.routes.test.ts).
 */
export const Admin = (action?: AuditKind) =>
  action
    ? applyDecorators(Roles('ADMIN'), SetMetadata(AUDIT, action), UseInterceptors(AuditInterceptor))
    : Roles('ADMIN')
