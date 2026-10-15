import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { loadEnv } from '../config/env'

// Stockage S3 local de deploy/compose.yaml (RustFS), utilisé hors production quand aucun bucket n'est configuré
const LOCAL_S3 = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'lucko',
  S3_ACCESS_KEY_ID: 'lucko',
  S3_SECRET_ACCESS_KEY: 'lucko-s3-local',
  S3_PUBLIC_URL: 'http://localhost:9000/lucko',
}

/**
 * Fichiers envoyés par les joueurs (photos de profil) dans un bucket S3. Clés non devinables :
 * les fichiers sont lus par leur URL publique, le bucket n'est jamais listable.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly env = loadEnv()
  private readonly config = this.env.S3_BUCKET
    ? this.env
    : this.env.NODE_ENV === 'production'
      ? null
      : { ...this.env, ...LOCAL_S3 }
  private readonly client = this.config
    ? new S3Client({
        endpoint: this.config.S3_ENDPOINT,
        region: this.config.S3_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.config.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: this.config.S3_SECRET_ACCESS_KEY ?? '',
        },
      })
    : null

  /** Enregistre le fichier et renvoie son URL publique. 503 si aucun stockage n'est configuré. */
  async put(key: string, body: Buffer, contentType: string) {
    if (!this.client || !this.config)
      throw new ServiceUnavailableException('Envoi de photo indisponible')
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
    return `${this.config.S3_PUBLIC_URL}/${key}`
  }

  /** Bucket joignable ? `null` si aucun stockage n'est configuré (GET /health, LKO-36). */
  async reachable() {
    if (!this.client || !this.config) return null
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }))
    return true
  }

  /** Efface le fichier d'une URL renvoyée par `put` ; une erreur est seulement journalisée. */
  async remove(url: string | null) {
    const prefix = `${this.config?.S3_PUBLIC_URL}/`
    if (!url || !this.client || !url.startsWith(prefix)) return
    const Key = url.slice(prefix.length)
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.config?.S3_BUCKET, Key }))
      .catch((error) => this.logger.warn(`Fichier ${Key} non effacé : ${error}`))
  }
}
