import sys
import uvicorn
import logging
import signal
import os

if __name__ == '__main__':
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('../backend_dev_log.txt')
        ]
    )
    logger = logging.getLogger('dashcam-dev')

    # Signal handler for clean shutdown
    def signal_handler(signum, frame):
        logger.info(f'Received signal {signum}, shutting down gracefully...')
        os._exit(0)

    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        logger.info('====== STARTING FASTAPI DEV SERVER WITH HOT RELOAD ======')
        print('Starting Uvicorn server on port 8000 with hot reload...')
        
        uvicorn.run(
            'main:app', 
            host='0.0.0.0', 
            port=8000, 
            log_level='info',
            reload=True,  # Enable hot reloading for development
            reload_dirs=[os.path.dirname(os.path.abspath(__file__)) + '/backend'],  # Watch this directory for changes
            timeout_keep_alive=120,  # Increase timeout for persistent WebSocket connections
            # WebSocket specific configuration
            ws_max_size=16777216,  # 16MB to allow transfer of large frames
            ws_ping_interval=30.0,  # Send ping every 30 seconds to maintain connection
            ws_ping_timeout=60.0,   # Timeout for ping of 60 seconds
        )
    except Exception as e:
        logger.critical(f'Fatal error starting Uvicorn: {e}', exc_info=True)
        print(f'Fatal error starting Uvicorn: {e}')
        sys.exit(1)
