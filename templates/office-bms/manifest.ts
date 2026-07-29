import type {TemplateManifest} from '@template-contract';

export const manifest: TemplateManifest = {
    id: 'office-bms',
    name: 'Office BMS',
    manifestVersion: 1,
    overridesSchemaVersion: 1,
    allowedOverrideKeys: [
        'clientName',
        'title',
        'subtitle',
        'logoUrl',
        'theme',
        'buildingName'
    ],
    requiredHostExports: [
        'useDevices',
        'useDeviceCapabilities',
        'useDeviceActions',
        'useGroups',
        'useLocations',
        'useCustomization',
        'useCurrentUser',
        'useLiveMetric',
        'useMetricHistory'
    ]
};

export default manifest;
