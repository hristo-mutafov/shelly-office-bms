export function wattHoursToKwh(value: number | null | undefined): number | null {
    return value != null ? value / 1000 : null;
}
