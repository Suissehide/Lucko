import {
  type AgendaQuery,
  agendaItemSchema,
  agendaQuerySchema,
  ageRegime,
  HOME_SAFETY_VERSION,
  homeSafetySchema,
  MIN_AGE,
  meSchema,
  myGamesSchema,
  type SetBirthDateInput,
  setBirthDateSchema,
  updateProfileSchema,
} from '@lucko/shared'
import {
  BadRequestException,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiBody, ApiConsumes, ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { AllowPendingConsent, CurrentUser } from '../auth/auth.decorators'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { AVATAR_MAX_BYTES } from './avatar.rules'
import { UsersService } from './users.service'

@ApiTags('users')
@Controller()
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  @ZodResponse(meSchema)
  me(@CurrentUser() user: User) {
    return this.users.profile(user)
  }

  /** Profil (F3) et onboarding (A4, A5) : seuls les champs envoyés changent. 409 si le pseudo est pris. */
  @Patch('me')
  @ZodResponse(meSchema)
  async update(
    @CurrentUser() user: User,
    @ZodBody(updateProfileSchema) body: z.output<typeof updateProfileSchema>,
  ) {
    return this.users.profile(await this.users.update(user, body))
  }

  /** Photo de profil (champ `file`, 5 Mo max). 400 si ce n'est pas une image, 422 si elle est refusée. */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ZodResponse(meSchema)
  async setAvatar(@CurrentUser() user: User, @UploadedFile() file?: { buffer: Buffer }) {
    if (!file) throw new BadRequestException('Photo manquante')
    return this.users.profile(await this.users.setAvatar(user, file.buffer))
  }

  /** Avertissement sécurité des rooms à domicile accepté (LKO-72), dans sa version actuelle. */
  @Put('me/home-safety')
  @ZodResponse(meSchema)
  async acceptHomeSafety(
    @CurrentUser() user: User,
    @ZodBody(homeSafetySchema) { version }: z.output<typeof homeSafetySchema>,
  ) {
    if (version !== HOME_SAFETY_VERSION)
      throw new ConflictException('L’avertissement a changé : relis-le avant de l’accepter')
    return this.users.profile(
      await this.prisma.user.update({
        where: { id: user.id },
        data: { homeSafetyVersion: version },
      }),
    )
  }

  /** Mes parties (D1) : à venir par date croissante, historique du plus récent au plus ancien. */
  @Get('me/agenda')
  @ZodResponse(z.array(agendaItemSchema))
  agenda(@CurrentUser() user: User, @ZodQuery(agendaQuerySchema) { period }: AgendaQuery) {
    return this.users.agenda(user.id, period)
  }

  /** Mes jeux (A6, F3) : jeux joués et niveau déclaré par format TCG. */
  @Get('me/games')
  @ZodResponse(myGamesSchema)
  myGames(@CurrentUser() user: User) {
    return this.users.myGames(user.id)
  }

  /** Remplace mes jeux ; les LK de départ suivent le niveau déclaré (850 à 1300). 400 avec le motif. */
  @Put('me/games')
  @ZodResponse(myGamesSchema)
  setMyGames(
    @CurrentUser() user: User,
    @ZodBody(myGamesSchema) body: z.output<typeof myGamesSchema>,
  ) {
    return this.users.setMyGames(user.id, body)
  }

  /**
   * Date de naissance après une première connexion Apple / Google (l'e-mail la donne à l'inscription).
   * Posée une seule fois. Sous l'âge minimum, le compte est supprimé : rien n'est conservé.
   */
  @Post('me/birth-date')
  @HttpCode(204)
  @AllowPendingConsent()
  async setBirthDate(
    @CurrentUser() user: User,
    @ZodBody(setBirthDateSchema) { birthDate }: SetBirthDateInput,
  ) {
    if (user.birthDate) throw new ConflictException('Date de naissance déjà renseignée')
    if (ageRegime(birthDate) === 'too-young') {
      await this.prisma.user.delete({ where: { id: user.id } })
      throw new ForbiddenException(`Compte réservé aux joueurs de ${MIN_AGE} ans et plus`)
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { birthDate } })
  }

  /**
   * Suppression du compte (exigence Apple, RGPD) : le joueur est anonymisé et ne peut plus se connecter
   * (`deletedAt`). La ligne reste pour les venues facturées aux lieux et l'historique des parties,
   * mais plus rien ne l'identifie ; ses places à venir sont libérées. Pour un parent, vaut retrait de
   * son accord : ses enfants de moins de 15 ans sont supprimés aussi (LKO-148).
   */
  @Delete('me')
  @HttpCode(204)
  @AllowPendingConsent()
  @ApiNoContentResponse()
  deleteMe(@CurrentUser() user: User) {
    return this.users.deleteAccount(user)
  }
}
