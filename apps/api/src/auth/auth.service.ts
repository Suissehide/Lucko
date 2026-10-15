import type { IncomingHttpHeaders } from 'node:http'
import { Injectable } from '@nestjs/common'
import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import type { Request } from 'express'
import { isSuspended } from '../admin/admin.rules'
import { loadEnv } from '../config/env'
import type { User, VenueStaffRole } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { type Auth, createAuth } from './better-auth'

export type AuthRequest = Request & { user?: User }

@Injectable()
export class AuthService {
  private readonly devHeader = loadEnv().DEV_AUTH_HEADER
  readonly auth: Auth
  /** Handler Express des routes /api/auth/* (inscription, connexion, Apple, Google, déconnexion). */
  readonly handler: ReturnType<typeof toNodeHandler>

  constructor(private readonly prisma: PrismaService) {
    this.auth = createAuth(prisma, loadEnv())
    this.handler = toNodeHandler(this.auth)
  }

  /**
   * Utilisateur à l'origine de la requête HTTP ou WebSocket (session Better Auth), ou null s'il n'est pas connecté.
   * En dev, avec DEV_AUTH_HEADER=true, l'en-tête `x-dev-user-id` connecte aussi les joueurs de démo du seed.
   * Un compte suspendu (LKO-20) compte comme déconnecté.
   */
  async resolveUser(headers: IncomingHttpHeaders): Promise<User | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) })
    const devId = this.devHeader ? headers['x-dev-user-id'] : undefined
    const id = session?.user.id ?? (typeof devId === 'string' ? devId : undefined)
    if (!id) return null
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } })
    return user && !isSuspended(user) ? user : null
  }

  /** IP et navigateur de la session en cours, tels que Better Auth les note (IP normalisée). */
  async sessionDevice(headers: IncomingHttpHeaders) {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(headers) })
    return {
      ip: session?.session.ipAddress || null,
      userAgent: session?.session.userAgent || null,
    }
  }

  /** Rôle du joueur dans un lieu, ou null s'il n'en fait pas partie. */
  async venueRole(userId: string, venueId: string): Promise<VenueStaffRole | null> {
    const staff = await this.prisma.venueStaff.findUnique({
      where: { userId_venueId: { userId, venueId } },
      select: { role: true },
    })
    return staff?.role ?? null
  }
}
