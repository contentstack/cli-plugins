type AppLocation =
  | 'cs.cm.stack.asset_sidebar'
  | 'cs.cm.stack.config'
  | 'cs.cm.stack.custom_field'
  | 'cs.cm.stack.dashboard'
  | 'cs.cm.stack.rte'
  | 'cs.cm.stack.sidebar'
  | 'cs.org.config';

interface ExtensionMeta {
  blur?: boolean;
  data_type?: string;
  default_width?: 'full' | 'half';
  description?: string;
  enabled?: boolean;
  extension_uid?: string;
  name?: string;
  path?: string;
  signed: boolean;
  uid?: string;
  width?: number;
}

interface Extension {
  meta: ExtensionMeta[];
  type: AppLocation;
}

interface LocationConfiguration {
  base_url: string;
  locations: Extension[];
  signed: boolean;
}

interface AnyProperty {
  [propName: string]: any;
}

type Manifest = {
  description: string;
  framework_version?: string;
  hosting?: any;
  icon?: string;
  name: string;
  oauth?: any;
  organization_uid: string;
  target_type: 'organization' | 'stack';
  ui_location: LocationConfiguration;
  uid: string;
  version?: number;
  visibility: 'private' | 'public' | 'public_unlisted';
  webhook?: any;
} & AnyProperty;

type Installation = {
  configuration: any;
  manifest: Manifest;
  server_configuration: any;
  status: string;
  target: { type: string; uid: string };
  ui_location: LocationConfiguration;
  uid: string;
} & AnyProperty;

export { Installation, Manifest };
