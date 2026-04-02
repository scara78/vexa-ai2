import indexHandler from './functions/index.js';
import chatHandler from './functions/chat.js';
import healthHandler from './functions/health.js';
import imageHandler from './functions/image.js';
import imageProxyHandler from './functions/image/proxy/[[id]].js';
import modelsHandler from './functions/models.js';
import queryHandler from './functions/query.js';
import notFoundHandler from './functions/404.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        try {
            if (pathname === '/') {
                return await indexHandler({ request, env, ctx });
            } else if (pathname === '/chat') {
                return await chatHandler({ request, env, ctx });
            } else if (pathname === '/health') {
                return await healthHandler({ request, env, ctx });
            } else if (pathname === '/image') {
                return await imageHandler({ request, env, ctx });
            } else if (pathname.startsWith('/image/proxy/')) {
                return await imageProxyHandler({ request, env, ctx });
            } else if (pathname === '/models') {
                return await modelsHandler({ request, env, ctx });
            } else if (pathname === '/query') {
                return await queryHandler({ request, env, ctx });
            } else {
                return await notFoundHandler({ request, env, ctx });
            }
        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({ 
                success: false, 
                error: 'Internal server error' 
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    }
};
