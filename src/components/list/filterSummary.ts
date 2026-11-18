type FilterSummaryGroup = {
  label?: string
  selected: readonly string[]
  options: readonly { key: string; label: string }[]
}

export function summarizeFilters(groups: readonly FilterSummaryGroup[]): string[] {
  return groups.flatMap((group) => {
    const selected = group.options
      .filter((option) => group.selected.includes(option.key))
      .map((option) => option.label)
    if (!selected.length) {
      return []
    }
    return [group.label ? `${group.label}：${selected.join('・')}` : selected.join('・')]
  })
}
