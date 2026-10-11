import { myXpSchema } from '@lucko/shared'
import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/auth.decorators'
import { ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { XpService } from './xp.service'

@ApiTags('users')
@Controller()
export class XpController {
  constructor(private readonly xp: XpService) {}

  /** Mon XP (LKO-89) : total, niveau nommé, progression et 10 derniers gains. */
  @Get('me/xp')
  @ZodResponse(myXpSchema)
  mine(@CurrentUser() user: User) {
    return this.xp.mine(user)
  }
}
