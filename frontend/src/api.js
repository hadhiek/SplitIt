import axios from 'axios';
import { supabase } from './lib/supabase';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

// Configure Axios to automatically attach the Supabase JWT
api.interceptors.request.use(async (config) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        config.headers.set('Authorization', `Bearer ${session.access_token}`);
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;