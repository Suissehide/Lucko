import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module'
import { ConsentController } from './consent.controller'
import { ConsentService } from './consent.service'

@Module({
  imports: [UsersModule],
  controllers: [ConsentController],
  providers: [ConsentService],
})
export class ConsentModule {}
