export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return Response.redirect(`hashpass://auth/qr/${encodeURIComponent(id)}`,307);}
