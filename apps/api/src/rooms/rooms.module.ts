import { Module } from '@nestjs/common'
import { AttendanceController } from './attendance.controller'
import { AttendanceService } from './attendance.service'
import { RoomsController } from './rooms.controller'
import { RoomsService } from './rooms.service'

@Module({
  controllers: [RoomsController, AttendanceController],
  providers: [RoomsService, AttendanceService],
})
export class RoomsModule {}
