declare module 'xlsx' {
  export function read(data: any, opts?: any): any;
  export function write(wb: any, opts?: any): any;
  export const utils: {
    json_to_sheet(data: any[], opts?: any): any;
    sheet_to_json(worksheet: any, opts?: any): any[];
    book_new(): any;
    book_append_sheet(wb: any, ws: any, name: string): void;
  };
}
