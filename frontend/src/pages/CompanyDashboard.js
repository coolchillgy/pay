import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../utils/AuthContext';
import { useSocket } from '../utils/SocketContext';

const CompanyDashboard = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const queryClient = useQueryClient();

  // 업체 거래내역 가져오기
  const { data: transactionData, isLoading } = useQuery(
    ['companyTransactions', user?.company_id],
    async () => {
      if (!user?.company_id) return { transactions: [] };
      const response = await axios.get(`/api/companies/${user.company_id}/transactions`);
      return response.data;
    },
    {
      refetchInterval: 10000, // 10초마다 자동 갱신
      refetchOnWindowFocus: true,
      enabled: !!user?.company_id
    }
  );

  // WebSocket 메시지 수신 시 데이터 갱신
  useEffect(() => {
    const handleSocketMessage = (event) => {
      const data = event.detail;
      if (data.type === 'new_transaction') {
        // 실시간 데이터 갱신
        queryClient.invalidateQueries(['companyTransactions', user?.company_id]);
      }
    };

    window.addEventListener('socketMessage', handleSocketMessage);
    return () => window.removeEventListener('socketMessage', handleSocketMessage);
  }, [queryClient, user?.company_id]);

  const handleLogout = () => {
    logout();
    toast.success('로그아웃 되었습니다');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ko-KR').format(amount || 0);
  };

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 오늘 거래 통계 계산
  const calculateTodayStats = (transactions) => {
    const today = new Date().toDateString();
    const todayTransactions = transactions.filter(tx => 
      new Date(tx.created_at).toDateString() === today
    );

    const stats = todayTransactions.reduce((acc, tx) => {
      if (tx.transaction_type === 'deposit') {
        acc.totalDeposits += tx.amount;
        acc.totalFees += tx.fee_amount;
      } else {
        acc.totalWithdrawals += tx.amount;
      }
      return acc;
    }, { totalDeposits: 0, totalWithdrawals: 0, totalFees: 0 });

    stats.netAmount = stats.totalDeposits - stats.totalWithdrawals;
    stats.transactionCount = todayTransactions.length;

    return stats;
  };

  const transactions = transactionData?.transactions || [];
  const todayStats = calculateTodayStats(transactions);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">거래 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

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
              <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
                업체 대시보드
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
        {/* 상단 기능 버튼들 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{user?.username} 업체</h2>
          
          <div className="flex space-x-3">
            <button
              onClick={() => toast.info('롤링내역 기능 준비 중')}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors font-medium"
            >
              롤링내역
            </button>
            <button
              onClick={() => toast.info('정산내역 기능 준비 중')}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors font-medium"
            >
              정산내역
            </button>
          </div>
        </div>

        {/* 실시간 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">금일 총입금</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(todayStats.totalDeposits)}원</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">금일 총출금</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(todayStats.totalWithdrawals)}원</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">입출금차액</p>
                <p className={`text-2xl font-bold ${todayStats.netAmount >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatCurrency(todayStats.netAmount)}원
                </p>
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
                <p className="text-2xl font-bold text-purple-600">{formatCurrency(todayStats.totalFees)}원</p>
              </div>
            </div>
          </div>
        </div>

        {/* 실시간 거래내역 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">실시간 거래내역</h3>
                <p className="text-sm text-gray-600 mt-1">최근 거래 100건 표시</p>
              </div>
              <div className="text-sm text-gray-600">
                총 {todayStats.transactionCount}건 거래
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-500 text-lg">거래 내역이 없습니다</p>
                <p className="text-gray-400 text-sm mt-2">문자자동전달앱 설정 후 거래가 표시됩니다</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">시간</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">거래유형</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">은행명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">금액</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">수수료</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">잔액</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDateTime(transaction.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          transaction.transaction_type === 'deposit' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {transaction.transaction_type === 'deposit' ? '입금' : '출금'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.bank_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {transaction.sender_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span className={`font-medium ${
                          transaction.transaction_type === 'deposit' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.transaction_type === 'deposit' ? '+' : '-'}{formatCurrency(transaction.amount)}원
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-purple-600 font-medium">
                        {formatCurrency(transaction.fee_amount)}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-medium">
                        {formatCurrency(transaction.balance)}원
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {transaction.is_rolling ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            롤링
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            일반
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* 하단 총계 */}
        <div className="mt-6 bg-gray-100 rounded-lg p-6">
          <div className="flex justify-between items-center text-lg font-semibold">
            <span className="text-gray-700">금일 거래 요약</span>
            <div className="flex space-x-6">
              <span className="text-green-600">
                입금: {formatCurrency(todayStats.totalDeposits)}원
              </span>
              <span className="text-red-600">
                출금: {formatCurrency(todayStats.totalWithdrawals)}원
              </span>
              <span className="text-blue-600">
                총 {todayStats.transactionCount}건
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanyDashboard; 