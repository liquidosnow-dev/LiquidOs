export interface CloudSandboxSpecs {
  plan: 'Free' | 'Plus' | 'Pro';
  cpus: number;
  ramGb: number;
  gpu: string;
  diskGb: number;
  status: 'RUNNING' | 'PAUSED' | 'WAKING';
  lastActive: number;
  autoPauseMinutes: number;
  uptimeSeconds: number;
  containerId: string;
  ipAddress: string;
}

export interface SandboxMetrics {
  cpuPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
  gpuPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  networkRxKb: number;
  networkTxKb: number;
  timestamp: number;
}

export interface D1DatabaseBinding {
  name: string;
  id: string;
  tables: { name: string; rowCount: number; schema: string }[];
}

export interface KVNamespaceBinding {
  name: string;
  id: string;
  keysCount: number;
  sampleKeys: { key: string; value: string; expiration?: number }[];
}

export interface R2BucketBinding {
  name: string;
  id: string;
  objectsCount: number;
  sizeBytes: number;
  sampleObjects: { key: string; size: number; lastModified: string }[];
}

export interface CloudflareBindings {
  d1Databases: D1DatabaseBinding[];
  kvNamespaces: KVNamespaceBinding[];
  r2Buckets: R2BucketBinding[];
}

export interface GensparkSiteConfig {
  siteId: string;
  name: string;
  subdomain: string;
  permanentUrl: string;
  customDomain?: string;
  cnameTarget: string;
  sslStatus: 'ISSUING' | 'ACTIVE' | 'PENDING_DNS';
  accessControl: 'public' | 'password' | 'team';
  passwordProtection?: string;
  analytics: {
    requests24h: number;
    latencyP95Ms: number;
    bandwidthMb: number;
    cacheHitRatio: number;
  };
  lastDeployedAt: number;
  status: 'ACTIVE' | 'DEPLOYING' | 'ERROR';
}

export interface CloudflareAccountConfig {
  apiToken: string;
  accountId: string;
  zoneId?: string;
  projectName: string;
  isConnected: boolean;
  deploymentUrl?: string;
  lastDeployedAt?: number;
}

export interface GitHubRepoConfig {
  connected: boolean;
  username: string;
  repoName: string;
  branch: string;
  isPrivate: boolean;
  repoUrl: string;
  lastPushedAt?: number;
  autoPushOnCommit: boolean;
}

export interface SandboxBackup {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: number;
  commitHash: string;
  filesCount: number;
}
