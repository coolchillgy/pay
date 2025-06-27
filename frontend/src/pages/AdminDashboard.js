import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../utils/AuthContext';
import { useSocket } from '../utils/SocketContext';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const queryClient = useQueryClient();

  // 관리자 대시보드 데이터 가져오기
  const { data: dashboardData, isLoading, error } = useQuery(
    'adminDashboard',
    async () => {
      const response = await axios.get('/api/admin/dashboard');
      return response.data;
    },
    {
      refetchInterval: 30000, // 30초마다 자동 갱신
      refetchOnWindowFocus: true,
    }
  );

  // WebSocket 메시지 수신 시 데이터 갱신
  useEffect(() => {
    const handleSocketMessage = (event) => {
      const data = event.detail;
      if (data.type === 'new_transaction' || data.type === 'company_created') {
        // 실시간 데이터 갱신
        queryClient.invalidateQueries('adminDashboard');
      }
    };

    window.addEventListener('socketMessage', handleSocketMessage);
    return () => window.removeEventListener('socketMessage', handleSocketMessage);
  }, [queryClient]);

  const handleLogout = () => {
    logout();
    toast.success('로그아웃 되었습니다');
    navigate('/login');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR').format(amount || 0);
  };

  const formatPercentage = (rate) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ 데이터 로딩 실패</div>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            새로고침
          </button>
        </div>
      </div>
    );
  }

  const { summary, companies } = dashboardData || { summary: {}, companies: [] };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                Pay<span className="text-blue-600">시스템</span>
              </h1>
              <span className="ml-4 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">
                관리자
              </span>
            </div>

            <div className="flex items-center space-x-4">
              {/* WebSocket 연결 상태 */}
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? '실시간 연결' : '연결 끊김'}
                </span>
              </div>

              <span className="text-gray-700">안녕하세요, {user?.username}님</span>
              
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 대시보드 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 실시간 통계 요약 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">총 업체 수</p>
                <p className="text-2xl font-bold text-gray-900">{summary.total_companies || 0}개</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">금일 총 입금</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.total_deposits)}원</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">발생 수수료</p>
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary.total_fees)}원</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">총 거래 건수</p>
                <p className="text-2xl font-bold text-orange-600">{summary.total_transactions || 0}건</p>
              </div>
            </div>
          </div>
        </div>

        {/* 업체 관리 섹션 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">업체 관리</h2>
              <p className="text-sm text-gray-600 mt-1">등록된 업체들의 실시간 정산 현황</p>
            </div>
            
            {/* 🎯 업체 추가 버튼 - 업체생성 버튼 문제 해결! */}
            <button
              onClick={() => {
                console.log('🚀 업체 추가 버튼 클릭!');
                navigate('/admin/companies/create');
              }}
              className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-md"
            >
              <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              업체 추가
            </button>
          </div>

          {/* 업체 목록 */}
          <div className="p-6">
            {companies.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-4a2 2 0 012-2h2a2 2 0 012 2v4" />
                </svg>
                <p className="text-gray-500 text-lg mb-4">등록된 업체가 없습니다</p>
                <button
                  onClick={() => navigate('/admin/companies/create')}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  첫 번째 업체 등록하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {companies.map((company) => (
                  <div key={company.id} className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{company.company_name}</h3>
                        <p className="text-sm text-gray-600">ID: {company.login_id}</p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            // 업체 상세 정보 모달 또는 페이지로 이동
                            toast.info('업체 상세 정보 기능 준비 중');
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
                          title="업체 정보 수정"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 업체별 통계 */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">금일 입금</p>
                        <p className="text-lg font-bold text-green-700">{formatCurrency(company.today_deposits)}원</p>
                      </div>
                      
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600 font-medium">금일 출금</p>
                        <p className="text-lg font-bold text-red-700">{formatCurrency(company.today_withdrawals)}원</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">입출금 차액</p>
                        <p className="text-lg font-bold text-blue-700">
                          {formatCurrency(company.today_deposits - company.today_withdrawals)}원
                        </p>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">발생 수수료</p>
                        <p className="text-lg font-bold text-purple-700">{formatCurrency(company.today_fees)}원</p>
                      </div>
                    </div>

                    {/* 추가 정보 */}
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>수수료율: <span className="font-medium text-gray-900">{formatPercentage(company.fee_rate)}</span></span>
                        <span>거래 건수: <span className="font-medium text-gray-900">{company.today_transactions}건</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard; 