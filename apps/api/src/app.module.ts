import { Module } from '@nestjs/common'
import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { ChatModule } from './chat/chat.module'
import { CheckinModule } from './checkin/checkin.module'
import { EventsModule } from './events/events.module'
import { ExploreModule } from './explore/explore.module'
import { GamesModule } from './games/games.module'
import { HealthModule } from './health/health.module'
import { JobsModule } from './jobs/jobs.module'
import { MailModule } from './mail/mail.module'
import { ModerationModule } from './moderation/moderation.module'
import { PlayIntentsModule } from './play-intents/play-intents.module'
import { PrismaModule } from './prisma/prisma.module'
import { PushModule } from './push/push.module'
import { RealtimeModule } from './realtime/realtime.module'
import { RoomsModule } from './rooms/rooms.module'
import { StorageModule } from './storage/storage.module'
import { UsersModule } from './users/users.module'
import { WaitlistModule } from './waitlist/waitlist.module'

@Module({
  imports: [
    PrismaModule,
    JobsModule,
    MailModule,
    StorageModule,
    PushModule,
    PlayIntentsModule,
    RealtimeModule,
    AuthModule,
    HealthModule,
    GamesModule,
    UsersModule,
    ExploreModule,
    EventsModule,
    WaitlistModule,
    ModerationModule,
    RoomsModule,
    AdminModule,
    ChatModule,
    CheckinModule,
  ],
})
export class AppModule {}
