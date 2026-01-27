import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { getErrorMessage } from '../../utils/error';
import {
  AUTH_INPUT_CLASSES,
  AUTH_LABEL_CLASSES,
  AUTH_ERROR_CLASSES,
  AUTH_ERROR_BOX_CLASSES,
  AUTH_BUTTON_CLASSES,
  AUTH_PAGE_CLASSES,
  AUTH_CARD_CLASSES,
  AUTH_TITLE_CLASSES,
  AUTH_SUBTITLE_CLASSES,
} from './styles';

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.register(data);
      setAuth(response.user, response.token);
      navigate('/files');
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={AUTH_PAGE_CLASSES}>
      <div className="max-w-md w-full mx-4 animate-fade-in">
        <div className={AUTH_CARD_CLASSES}>
          <div className="flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
          </div>

          <h1 className={AUTH_TITLE_CLASSES}>
            Create Account
          </h1>
          <p className={AUTH_SUBTITLE_CLASSES}>
            Sign up to start uploading files
          </p>

          {error && (
            <div className={AUTH_ERROR_BOX_CLASSES}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={AUTH_LABEL_CLASSES}>
                Username
              </label>
              <input
                {...register('username')}
                type="text"
                className={AUTH_INPUT_CLASSES}
                placeholder="johndoe"
              />
              {errors.username && (
                <p className={AUTH_ERROR_CLASSES}>
                  {errors.username.message}
                </p>
              )}
            </div>

            <div>
              <label className={AUTH_LABEL_CLASSES}>
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                className={AUTH_INPUT_CLASSES}
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className={AUTH_ERROR_CLASSES}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className={AUTH_LABEL_CLASSES}>
                Password
              </label>
              <input
                {...register('password')}
                type="password"
                className={AUTH_INPUT_CLASSES}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className={AUTH_ERROR_CLASSES}>
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={AUTH_BUTTON_CLASSES}
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className="mt-6 text-center text-gray-400">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
