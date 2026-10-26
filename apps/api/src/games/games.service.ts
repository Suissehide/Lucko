import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    // Doublons en attente de fusion : invisibles des joueurs (LKO-164)
    return this.prisma.game.findMany({
      where: { hidden: false },
      include: { formats: { orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    })
  }
}
