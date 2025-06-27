import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSocket } from '../utils/SocketContext';

const CompanyCreate = () => {
  const navigate = useNavigate();
  const { playNotificationSound } = useSocket();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    login_id: '',
    password: '',
    bank_name: '',
    account_number: '',
    account_holder: '',
    fee_rate: 0.03
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 유효성 검사
    if (!formData.company_name.trim()) {
      toast.error('업체명을 입력해주세요');
      return;
    }
    
    if (!formData.login_id.trim()) {
      toast.error('로그인 ID를 입력해주세요');
      return;
    }
    
    if (!formData.password.trim()) {
      toast.error('비밀번호를 입력해주세요');
      return;
    }
    
    if (!formData.bank_name.trim()) {
      toast.error('은행명을 입력해주세요');
      return;
    }
    
    if (!formData.account_number.trim()) {
      toast.error('계좌번호를 입력해주세요');
      return;
    }
    
    if (!formData.account_holder.trim()) {
      toast.error('예금주명을 입력해주세요');
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🚀 업체 생성 요청:', formData);
      
      const response = await axios.post('/api/admin/companies', formData);
      
      console.log('✅ 업체 생성 성공:', response.data);
      
      // 성공 알림
      toast.success(`🎉 업체 "${formData.company_name}" 생성 완료!`);
      playNotificationSound();
      
      // 생성된 API 키 정보 표시
      toast.success(
        `🔑 API 키: ${response.data.api_key.substring(0, 8)}...`,
        { duration: 8000 }
      );
      
      // SMS 설정 가이드 알림
      toast.info(
        `📱 문자자동전달앱에 설정할 URL:\n/api/webhook/${response.data.api_key}`,
        { duration: 10000 }
      );
      
      // 관리자 페이지로 이동
      setTimeout(() => {
        navigate('/admin');
      }, 2000);
      
    } catch (error) {
      console.error('❌ 업체 생성 실패:', error);
      
      const errorMessage = error.response?.data?.detail || '업체 생성에 실패했습니다';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const bankOptions = [
    '농협', '신한', '국민', '우리', '하나', '기업',
    'SC제일', '씨티', '대구', '부산', '광주', '전북',
    '경남', '새마을', '신협', '우체국', '카카오뱅크', '토스뱅크'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            관리자 대시보드로 돌아가기
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">새 업체 등록</h1>
          <p className="text-gray-600">실시간 정산 업체를 등록하고 API 키를 발급받습니다</p>
        </div>

        {/* 메인 폼 카드 */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-blue-500 to-purple-600">
            <h2 className="text-xl font-semibold text-white">업체 정보 입력</h2>
            <p className="text-blue-100 text-sm mt-1">모든 필드를 정확히 입력해주세요</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* 업체명 */}
            <div>
              <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                업체명 *
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={formData.company_name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="예: 홍길동 상사"
                disabled={isLoading}
              />
            </div>

            {/* 로그인 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="login_id" className="block text-sm font-medium text-gray-700 mb-2">
                  로그인 ID *
                </label>
                <input
                  type="text"
                  id="login_id"
                  name="login_id"
                  value={formData.login_id}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="영문/숫자 조합"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 *
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="안전한 비밀번호"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* 계좌 정보 */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">지정 계좌 정보</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="bank_name" className="block text-sm font-medium text-gray-700 mb-2">
                    은행명 *
                  </label>
                  <select
                    id="bank_name"
                    name="bank_name"
                    value={formData.bank_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    disabled={isLoading}
                  >
                    <option value="">은행 선택</option>
                    {bankOptions.map(bank => (
                      <option key={bank} value={bank}>{bank}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="account_number" className="block text-sm font-medium text-gray-700 mb-2">
                    계좌번호 *
                  </label>
                  <input
                    type="text"
                    id="account_number"
                    name="account_number"
                    value={formData.account_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="123-456-789012"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label htmlFor="account_holder" className="block text-sm font-medium text-gray-700 mb-2">
                    예금주명 *
                  </label>
                  <input
                    type="text"
                    id="account_holder"
                    name="account_holder"
                    value={formData.account_holder}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="홍길동"
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                💡 지정 계좌: 롤링 거래 구분을 위한 업체 전용 계좌입니다
              </p>
            </div>

            {/* 수수료율 */}
            <div>
              <label htmlFor="fee_rate" className="block text-sm font-medium text-gray-700 mb-2">
                수수료율 (%)
              </label>
              <input
                type="number"
                id="fee_rate"
                name="fee_rate"
                value={formData.fee_rate * 100}
                onChange={(e) => setFormData(prev => ({ ...prev, fee_rate: parseFloat(e.target.value) / 100 || 0 }))}
                step="0.1"
                min="0"
                max="10"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="3.0"
                disabled={isLoading}
              />
              <p className="text-sm text-gray-500 mt-1">
                입금 거래 시 적용될 수수료율 (기본: 3%)
              </p>
            </div>

            {/* 제출 버튼 */}
            <div className="flex gap-4 pt-6">
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex-1 py-3 px-6 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                disabled={isLoading}
              >
                취소
              </button>
              
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-6 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    업체 생성 중...
                  </div>
                ) : (
                  '✨ 업체 생성하기'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 안내 정보 */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-medium text-blue-900 mb-3">📋 업체 생성 후 설정 안내</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>1. 업체 생성 시 고유한 API 키가 자동 발급됩니다</p>
            <p>2. 발급된 API 키로 문자자동전달앱 설정이 가능합니다</p>
            <p>3. 업체 계정으로 로그인하여 실시간 정산 현황을 확인할 수 있습니다</p>
            <p>4. 모든 거래는 실시간으로 관리자 페이지에 동기화됩니다</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyCreate; 