export type BmsThemeTokens = {
    primary?: string;
    accent?: string;
    background?: string;
    surface?: string;
    text?: string;
    sidebar?: string;
    card?: string;
};

export type BmsOverrides = {
    schemaVersion: number;
    clientName?: string;
    title?: string;
    subtitle?: string;
    logoUrl?: string;
    theme?: BmsThemeTokens;
    buildingName?: string;
};
