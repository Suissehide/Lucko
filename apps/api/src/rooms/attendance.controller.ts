import {
  attendanceSheetSchema,
  markAttendanceSchema,
  venueAttendanceQuerySchema,
} from '@lucko/shared'
import { Controller, Get, Param, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { CurrentUser, VenueRoles } from '../auth/auth.decorators'
import { ZodBody, ZodQuery, ZodResponse } from '../common/zod'
import type { User } from '../generated/prisma/client'
import { AttendanceService } from './attendance.service'

/** Pointage des présents (LKO-78), par l'hôte de la room ou le staff du lieu. */
@ApiTags('rooms')
@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  /** Feuille de pointage d'une room. 403 si l'on n'est ni l'hôte ni le staff du lieu. */
  @Get('rooms/:id/attendance')
  @ZodResponse(attendanceSheetSchema)
  sheet(@Param('id') id: string, @CurrentUser() user: User) {
    return this.attendance.sheet(id, user)
  }

  /**
   * Pointer présents / absents (et, pour le lieu, le montant du ticket). 409 avec le motif hors de la
   * fenêtre de pointage ; les joueurs verrouillés (scan, déjà pointés par le lieu) sont laissés tels quels.
   */
  @Put('rooms/:id/attendance')
  @ZodResponse(attendanceSheetSchema)
  mark(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @ZodBody(markAttendanceSchema) { entries }: z.output<typeof markAttendanceSchema>,
  ) {
    return this.attendance.mark(id, user, entries)
  }

  /** Back-office lieu : les rooms de la soirée et leurs présents. */
  @Get('venues/:venueId/attendance')
  @VenueRoles('MANAGER', 'STAFF')
  @ZodResponse(z.array(attendanceSheetSchema))
  venue(
    @Param('venueId') venueId: string,
    @ZodQuery(venueAttendanceQuerySchema) { date }: z.output<typeof venueAttendanceQuerySchema>,
  ) {
    return this.attendance.venueSheets(venueId, date)
  }
}
