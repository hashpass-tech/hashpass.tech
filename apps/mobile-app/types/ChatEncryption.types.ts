export type ChatKeyApiData = {
  success: boolean;
  error?: string;
  public_key?: string;
  encrypted_private_key?: string;
  salt?: string;
  created_at?: string;
  backup_available?: boolean;
};

export type ChatKeyRequestResult = {
  data: ChatKeyApiData | null;
  error: { message: string } | null;
};
