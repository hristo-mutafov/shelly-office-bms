export type TemplateManifest = {
    id: string;
    name: string;
    manifestVersion: number;
    overridesSchemaVersion: number;
    allowedOverrideKeys: string[];
    requiredHostExports: string[];
};
