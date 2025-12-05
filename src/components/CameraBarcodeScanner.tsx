import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Loader2 } from 'lucide-react';

interface CameraBarcodeScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const CameraBarcodeScanner = ({ onScan, onClose }: CameraBarcodeScannerProps) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startScanning = async () => {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;

        // Настройки для сканирования штрих-кодов
        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Используем заднюю камеру
          config,
          (decodedText) => {
            // Успешно отсканировано
            html5QrCode.stop().then(() => {
              setIsScanning(false);
              onScan(decodedText);
            }).catch(() => {
              setIsScanning(false);
            });
          },
          (_errorMessage) => {
            // Игнорируем ошибки сканирования (они нормальны при поиске кода)
          }
        );

        setIsScanning(true);
        setError(null);
      } catch (err: any) {
        console.error('Error starting camera:', err);
        setError('Не удалось открыть камеру. Проверьте разрешения.');
        setIsScanning(false);
      }
    };

    startScanning();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {
          // Игнорируем ошибки при остановке
        });
      }
    };
  }, [onScan]);

  const handleStop = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 px-4 py-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          Сканирование штрих-кода
        </h3>
        <button
          onClick={handleStop}
          className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Scanner */}
      <div className="w-full h-full flex items-center justify-center">
        <div id="reader" className="w-full h-full"></div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black bg-opacity-75 px-4 py-6">
        {error ? (
          <div className="text-center">
            <p className="text-red-400 mb-3">{error}</p>
            <button
              onClick={handleStop}
              className="px-6 py-3 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <div className="text-center text-white">
            {isScanning ? (
              <>
                <p className="text-lg font-semibold mb-2">Наведите камеру на штрих-код</p>
                <p className="text-sm text-gray-300">Штрих-код будет отсканирован автоматически</p>
              </>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <p className="text-sm">Инициализация камеры...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraBarcodeScanner;

