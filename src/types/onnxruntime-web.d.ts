declare namespace ort {
  class Tensor<T = any> {
    constructor(type: string, data: any, dims: number[]);
    data: any;
  }

  class InferenceSession {
    static create(path: string, options?: any): Promise<InferenceSession>;
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }
}

declare module 'onnxruntime-web' {
  export = ort;
}

