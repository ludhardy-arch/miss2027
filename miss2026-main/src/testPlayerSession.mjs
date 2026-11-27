// Test-only isolated Firebase app names. No authentication tokens in URLs.
export const TEST_ORIGIN="https://miss2027-test.onrender.com";
const validId=id=>typeof id==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id);
export function testPlayerAppName(href){
 const url=new URL(href);
 if(isAdminSession(href))return undefined;
 const id=url.searchParams.get("testPlayer");
 return url.origin===TEST_ORIGIN&&validId(id)?"test-player-"+id:undefined;
}
export function testPlayerUrl(href,id){
 if(new URL(href).origin!==TEST_ORIGIN||!validId(id))return null;
 const url=new URL(TEST_ORIGIN);
 url.searchParams.set("testPlayer",id);
 url.hash="/login";
 return url.href;
}

export const ADMIN_APP_NAME="miss2027-test-regie";
export function isAdminSession(href){
 const url=new URL(href);
 return url.origin===TEST_ORIGIN&&url.searchParams.get("regie")==="1";
}
export function adminSessionUrl(href){
 if(new URL(href).origin!==TEST_ORIGIN)return null;
 const url=new URL(TEST_ORIGIN);
 url.searchParams.set("regie","1");
 url.hash="/admin";
 return url.href;
}
export function sessionAppName(href){
 return isAdminSession(href)?ADMIN_APP_NAME:testPlayerAppName(href);
}
export function authorizedAdmin(user,uid,provider){
 return !!uid&&user?.uid===uid&&user.isAnonymous===false&&provider==="google.com";
}
