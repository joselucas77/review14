import { supabase, supabaseAdmin } from "../db/client";

export interface PresignedUrlParams {
  companyId: string;
  filename: string;
  contentType: string;
  expiresInSeconds?: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  fileKey: string;
  publicUrl: string;
}

export interface StorageUploadParams {
  bucket?: string;
  filePath: string;
  file: Blob | Buffer | Uint8Array;
  contentType?: string;
}

export class StorageService {
  public static readonly DEFAULT_BUCKET = "reviews";

  /**
   * Gera uma URL pré-assinada ou caminho público no Supabase Storage
   * Mantém total compatibilidade de assinatura com a integração anterior
   */
  static async createPresignedUploadUrl({
    companyId,
    filename,
    contentType,
    expiresInSeconds = 300,
  }: PresignedUrlParams): Promise<PresignedUrlResult> {
    const ext = filename.split(".").pop() || "jpg";
    const randomId = crypto.randomUUID();
    const fileKey = `${companyId}/${Date.now()}-${randomId}.${ext}`;

    // Cria a URL assinada para upload direto via Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(this.DEFAULT_BUCKET)
      .createSignedUploadUrl(fileKey);

    if (error || !data) {
      // Fallback para getPublicUrl se não suportar signed upload url direto
      const { data: pubData } = supabase.storage
        .from(this.DEFAULT_BUCKET)
        .getPublicUrl(fileKey);

      return {
        uploadUrl: pubData.publicUrl,
        fileKey,
        publicUrl: pubData.publicUrl,
      };
    }

    const { data: pubData } = supabase.storage
      .from(this.DEFAULT_BUCKET)
      .getPublicUrl(fileKey);

    return {
      uploadUrl: data.signedUrl,
      fileKey,
      publicUrl: pubData.publicUrl,
    };
  }

  /**
   * Upload direto de um arquivo pelo backend para o Supabase Storage
   */
  static async uploadFile({
    bucket = this.DEFAULT_BUCKET,
    filePath,
    file,
    contentType = "image/jpeg",
  }: StorageUploadParams) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, file, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Falha no upload do Supabase Storage: ${error.message}`);
    }

    const { data: pubData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      filePath: data.path,
      publicUrl: pubData.publicUrl,
    };
  }

  /**
   * Retorna a URL pública de um arquivo
   */
  static getPublicUrl(filePath: string, bucket = this.DEFAULT_BUCKET): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  /**
   * Remove um arquivo do bucket
   */
  static async deleteFile(filePath: string, bucket = this.DEFAULT_BUCKET) {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      throw new Error(`Erro ao deletar arquivo do Supabase Storage: ${error.message}`);
    }
  }
}

// Alias de retrocompatibilidade para não quebrar referências legadas
export const R2Service = StorageService;
