import {
  myParentalConsentSchema,
  parentalConsentRequestSchema,
  type RequestParentalConsentInput,
  requestParentalConsentSchema,
} from '@lucko/shared'
import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common'
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger'
import { AllowPendingConsent, CurrentUser, Public } from '../auth/auth.decorators'
import { type AuthRequest, AuthService } from '../auth/auth.service'
import { ZodBody, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { ConsentService } from './consent.service'

/** Accord parental des 13-14 ans (LKO-49). */
@ApiTags('consent')
@Controller()
export class ConsentController {
  constructor(
    private readonly consent: ConsentService,
    private readonly auth: AuthService,
  ) {}

  /** Où en est l'accord de mon parent. */
  @Get('me/parental-consent')
  @ZodResponse(myParentalConsentSchema)
  mine(@CurrentUser() user: User) {
    return this.consent.mine(user)
  }

  /** Envoie (ou renvoie) l'e-mail au parent ; remplace la demande précédente. */
  @Post('me/parental-consent')
  @HttpCode(200)
  @AllowPendingConsent()
  @ZodResponse(myParentalConsentSchema)
  request(
    @CurrentUser() user: User,
    @ZodBody(requestParentalConsentSchema) { parentEmail }: RequestParentalConsentInput,
  ) {
    return this.consent.request(user, parentEmail)
  }

  /** Demande vue par le parent qui ouvre le lien (sans être connecté). 404 : lien plus valable. */
  @Get('parental-consents/:token')
  @Public()
  @ZodResponse(parentalConsentRequestSchema)
  show(@Param('token') token: string) {
    return this.consent.show(token)
  }

  /** Accord du parent connecté. 403 : pas majeur, ou c'est l'enfant lui-même. */
  @Post('parental-consents/:token')
  @HttpCode(204)
  @ApiNoContentResponse()
  async grant(
    @Param('token') token: string,
    @CurrentUser() parent: User,
    @Req() request: AuthRequest,
  ) {
    await this.consent.grant(token, parent, await this.auth.sessionDevice(request.headers))
  }
}
