import type { ScanResult } from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { isSuspended } from '../admin/admin.rules'
import { BillingService } from '../billing/billing.service'
import { isMinor } from '../common/minors.rules'
import { loadEnv } from '../config/env'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { XpService } from '../xp/xp.service'
import { businessDate, qrKey, signQrToken, verifyQrToken } from './qr.rules'

/**
 * QR Lucko (LKO-77, archi §10) : jeton généré et vérifié côté serveur uniquement. Un scan au comptoir
 * d'un lieu partenaire crée la venue du soir (Visit) ; un jeton ne sert qu'une fois.
 */
@Injectable()
export class CheckinService {
  private readonly key = qrKey(loadEnv().BETTER_AUTH_SECRET)

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly xp: XpService,
  ) {}

  token(userId: string) {
    return signQrToken(this.key, userId)
  }

  async scan(venueId: string, token: string): Promise<ScanResult> {
    const now = new Date()
    const check = verifyQrToken(this.key, token, now)
    if ('refused' in check) throw new BadRequestException(check.refused)
    const [venue, player] = await Promise.all([
      this.prisma.venue.findUnique({
        where: { id: venueId },
        select: { isPartner: true, luckoPerk: true },
      }),
      this.prisma.user.findUnique({
        where: { id: check.userId },
        select: {
          id: true,
          pseudo: true,
          birthDate: true,
          parentId: true,
          deletedAt: true,
          suspendedAt: true,
          suspendedUntil: true,
        },
      }),
    ])
    if (!venue) throw new NotFoundException('Lieu introuvable')
    if (!venue.isPartner) throw new ForbiddenException('Le scan est réservé aux lieux partenaires')
    if (!player || player.deletedAt || isSuspended(player, now))
      throw new BadRequestException('Ce compte Lucko n’est plus actif')

    let alreadyScanned = false
    try {
      await this.prisma.visit.create({
        data: {
          userId: check.userId,
          venueId,
          source: 'QR_SCAN',
          businessDate: new Date(`${businessDate(now)}T00:00:00Z`),
          qrNonce: check.nonce,
          ...(await this.billing.visitFields(this.prisma, venueId, check.userId)),
        },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'))
        throw error
      // Nonce déjà vu : capture rejouée ; sinon le joueur est déjà passé ce soir (scan ou pointage)
      if (await this.prisma.visit.findUnique({ where: { qrNonce: check.nonce } }))
        throw new ConflictException('QR déjà utilisé : demande au joueur de rouvrir son QR Lucko')
      alreadyScanned = true
    }
    // Le scan valide la présence dans ses rooms du soir ici : XP de participation (LKO-89)
    if (!alreadyScanned) await this.xp.scanned(check.userId, venueId, businessDate(now))
    return {
      pseudo: player.pseudo,
      minor: isMinor(player, now),
      perk: venue.luckoPerk,
      alreadyScanned,
    }
  }
}
