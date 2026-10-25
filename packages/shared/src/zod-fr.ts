import { z } from 'zod'

// Messages par défaut de Zod en français (LKO-156) : l'app affiche telles quelles les erreurs 400 de l'API
// (« Trop grand… » plutôt que « Too big… »). Les messages écrits dans les schémas restent prioritaires.
z.config(z.locales.fr())
