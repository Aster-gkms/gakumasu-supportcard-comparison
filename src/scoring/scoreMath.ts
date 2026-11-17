// タイプ別集計と凸数の検証を共通化する。丸めは各効果の計算側で行う。
export const scoreTypes = ['vo', 'da', 'vi'] as const
export type ScoreType = (typeof scoreTypes)[number]
export type TypeScores = Record<ScoreType, number>

export function emptyTypeScores(): TypeScores {
  return { vo: 0, da: 0, vi: 0 }
}

export function scoreTargets(type: string): readonly ScoreType[] {
  return type === 'all' ? scoreTypes : [type as ScoreType]
}

export function sumTypeScores(scores: TypeScores): number {
  return scores.vo + scores.da + scores.vi
}

export function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 0 || limit > 4) {
    throw new Error('凸数は0～4で指定してください。')
  }
}
