export interface ApiResponseData<T> {
    status: boolean;
    message: string;
    data: T | null;
}

export interface PaginatedData {
    totalData: number;
    totalPages: number;
    currentPage: number;
    perPage: number;
}

export interface FileUpload {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
}