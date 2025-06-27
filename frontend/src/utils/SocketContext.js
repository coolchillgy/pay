import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      // 로그아웃 시 소켓 연결 해제
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // WebSocket 연결 (Socket.IO 대신 순수 WebSocket 사용)
    const baseURL = process.env.NODE_ENV === 'production' 
      ? 'wss://your-backend.railway.app' 
      : 'ws://localhost:8000';
    
    let wsUrl;
    if (user.role === 'admin') {
      wsUrl = `${baseURL}/ws/admin`;
    } else if (user.role === 'company') {
      wsUrl = `${baseURL}/ws/company/${user.company_id}`;
    }

    if (wsUrl) {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket 연결됨:', user.role);
        setIsConnected(true);
        toast.success('실시간 연결 활성화됨');
      };

      ws.onclose = () => {
        console.log('❌ WebSocket 연결 끊김');
        setIsConnected(false);
      };

      ws.onerror = (error) => {
        console.error('WebSocket 오류:', error);
        setIsConnected(false);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleSocketMessage(data);
        } catch (error) {
          console.error('메시지 파싱 오류:', error);
        }
      };

      setSocket(ws);
    }

    // 정리
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [user]);

  const handleSocketMessage = (data) => {
    console.log('📨 실시간 메시지:', data);
    
    switch (data.type) {
      case 'new_transaction':
        // 새 거래 알림
        const tx = data.data;
        const amount = new Intl.NumberFormat('ko-KR').format(tx.amount);
        
        // 알림음 재생
        playNotificationSound();
        
        toast.success(
          `💰 ${tx.transaction_type === 'deposit' ? '입금' : '출금'} ${amount}원 (${tx.bank_name})`,
          { duration: 6000 }
        );
        break;
        
      case 'company_created':
        // 업체 생성 알림
        toast.success(`🏢 새 업체 생성됨: ${data.data.company_name}`);
        playNotificationSound();
        break;
        
      case 'company_updated':
        // 업체 정보 업데이트
        toast.info(`📝 업체 정보 업데이트됨: ${data.data.company_name}`);
        break;
        
      case 'system_notification':
        // 시스템 알림
        toast.info(data.message);
        break;
        
      default:
        console.log('알 수 없는 메시지 타입:', data.type);
    }
    
    // 커스텀 이벤트 발송 (컴포넌트에서 구독 가능)
    window.dispatchEvent(new CustomEvent('socketMessage', { detail: data }));
  };

  const playNotificationSound = () => {
    try {
      // Web Audio API로 알림음 생성
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // 간단한 삐 소리 생성
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log('알림음 재생 실패:', error);
    }
  };

  const sendMessage = (message) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const value = {
    socket,
    isConnected,
    sendMessage,
    playNotificationSound
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 