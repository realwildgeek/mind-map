export async function onRequestGet({ env, params }) {
  const object = await env.MY_R2_BUCKET.get(`maps/${params.id}.json`);
  if (!object) return new Response('null', { status: 404 });
  return new Response(object.body);
}

export async function onRequestPut({ request, env, params }) {
  const data = await request.text();
  await env.MY_R2_BUCKET.put(`maps/${params.id}.json`, data);
  return new Response('OK');
}
