// OAuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '@/store';
import { fetchMe } from '@/store/slices/authSlice';
import toast from 'react-hot-toast';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error || !token) {
      toast.error('Google sign-in failed. Please try again.');
      navigate('/login', { replace: true });
      return;
    }

    localStorage.setItem('accessToken', token);

    dispatch(fetchMe()).then((result) => {
      if (fetchMe.fulfilled.match(result)) {
        toast.success(`Welcome back, ${result.payload.name}!`);
        navigate('/', { replace: true });
      } else {
        localStorage.removeItem('accessToken');
        toast.error('Sign-in failed. Please try again.');
        navigate('/login', { replace: true });
      }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default OAuthCallback;
