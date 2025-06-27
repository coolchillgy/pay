import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login, user } = useAuth();

  // 이미 로그인된 경우 리다이렉트
  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/company'} replace />;
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error('아이디와 비밀번호를 입력해주세요');
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        toast.success('로그인 성공!');
        // AuthContext에서 자동으로 리다이렉트됨
      } else {
        toast.error(result.error || '로그인에 실패했습니다');
      }
    } catch (error) {
      toast.error('로그인 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* 배경 효과 */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-grid-16" />
      
      {/* 메인 로그인 박스 */}
      <div className="relative w-full max-w-md">
        {/* 글라스모피즘 카드 */}
        <div className="backdrop-blur-lg bg-white/10 rounded-2xl shadow-2xl border border-white/20 p-8">
          {/* 로고 및 제목 */}
          <div className="text-center mb-8">
            <div className="mb-4">
              <h1 className="text-4xl font-bold text-white mb-2">
                Pay
                <span className="text-blue-400">시스템</span>
              </h1>
              <div className="w-16 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
            </div>
            <p className="text-gray-300 text-sm">
              실시간 정산 관리 시스템
            </p>
          </div>

          {/* 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 아이디 입력 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                아이디
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                placeholder="아이디를 입력하세요"
                disabled={isLoading}
              />
            </div>

            {/* 비밀번호 입력 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all duration-200"
                placeholder="비밀번호를 입력하세요"
                disabled={isLoading}
              />
            </div>

            {/* 로그인 버튼 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  로그인 중...
                </div>
              ) : (
                '로그인'
              )}
            </button>
          </form>

          {/* 하단 정보 */}
          <div className="mt-8 text-center">
            <div className="text-xs text-gray-400 space-y-1">
              <p>관리자: fjrzl7979 / 79797979</p>
              <p>Pay System v4.0 Enterprise</p>
            </div>
          </div>
        </div>

        {/* 하단 데코레이션 */}
        <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent rounded-full opacity-50"></div>
      </div>
    </div>
  );
};

export default LoginPage; 