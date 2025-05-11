import logging
import av
import fractions
import numpy as np
import cv2
import time
import re
import json
from aiortc import RTCIceCandidate, RTCSessionDescription

logger = logging.getLogger(__name__)

def create_video_frame(frame, frame_counter, target_fps=10):
    """Convert numpy frame to av.VideoFrame with proper timing parameters"""
    try:
        # Convert to VideoFrame
        av_frame = av.VideoFrame.from_ndarray(frame, format="bgr24")
        
        # Set timing parameters
        av_frame.time_base = fractions.Fraction(1, 90000)  # Standard for video
        av_frame.pts = frame_counter
        
        return av_frame, frame_counter + 90000 // target_fps
    except Exception as e:
        logger.error(f"Error creating video frame: {str(e)}")
        
        # Create error frame
        error_img = np.zeros((480, 640, 3), dtype=np.uint8)
        error_msg = f"Error: {str(e)}"
        cv2.putText(error_img, error_msg, (50, 240), cv2.FONT_HERSHEY_SIMPLEX, 
                   0.7, (255, 255, 255), 2, cv2.LINE_AA)
        
        # Convert to VideoFrame
        error_frame = av.VideoFrame.from_ndarray(error_img, format="bgr24")
        error_frame.time_base = fractions.Fraction(1, 90000)
        error_frame.pts = frame_counter
        
        return error_frame, frame_counter + 90000 // target_fps

def parse_sdp_offer(offer):
    """Extract and validate SDP offer information"""
    offer_media_sections = re.findall(r'm=([^\r\n]+)', offer.sdp)
    offer_mids = re.findall(r'a=mid:([^\r\n]+)', offer.sdp)
    
    return {
        "media_sections": offer_media_sections,
        "mids": offer_mids,
        "is_valid": len(offer_media_sections) > 0
    }

def create_custom_sdp_offer():
    """Create a basic SDP offer when the client's offer is invalid"""
    # Create basic session
    session_lines = [
        'v=0',
        f'o=- {int(time.time())} 1 IN IP4 0.0.0.0',
        's=dashcam-session',
        't=0 0',
        'a=group:BUNDLE 0',
        'a=msid-semantic:WMS'
    ]
    
    # Create basic video section
    media_section = [
        'm=video 9 UDP/TLS/RTP/SAVPF 96',
        'c=IN IP4 0.0.0.0',
        'a=rtcp:9 IN IP4 0.0.0.0',
        'a=rtcp-mux',
        'a=ice-ufrag:dashcam',
        'a=ice-pwd:dashcampwd',
        'a=mid:0',
        'a=rtpmap:96 H264/90000',
        'a=recvonly',
        'a=setup:actpass'
    ]
    
    # Combine into full SDP
    sdp = '\r\n'.join(session_lines) + '\r\n' + '\r\n'.join(media_section)
    return RTCSessionDescription(sdp=sdp, type="offer")

def create_custom_sdp_answer(offer_sdp):
    """Create a custom SDP answer when the normal answer creation fails"""
    # Extract session info from offer
    session_lines = []
    for line in offer_sdp.split('\r\n'):
        if line.startswith('v=') or line.startswith('s=') or line.startswith('t='):
            session_lines.append(line)
        elif line.startswith('o='):
            # Update origin line for answer
            session_lines.append(f'o=- {int(time.time())} 1 IN IP4 0.0.0.0')
    
    # Add bundle and msid lines if present in offer
    if 'a=group:BUNDLE' in offer_sdp:
        bundle_match = re.search(r'a=group:BUNDLE\s*(.*)', offer_sdp)
        if bundle_match:
            session_lines.append(bundle_match.group(0))
    
    if 'a=msid-semantic' in offer_sdp:
        msid_match = re.search(r'a=msid-semantic.*', offer_sdp)
        if msid_match:
            session_lines.append(msid_match.group(0))
    
    # Create video media section
    video_section = [
        'm=video 9 UDP/TLS/RTP/SAVPF 96',
        'c=IN IP4 0.0.0.0',
        'a=rtcp:9 IN IP4 0.0.0.0',
        'a=rtcp-mux',
        'a=ice-ufrag:dashcam',
        'a=ice-pwd:dashcampwd',
        'a=fingerprint:sha-256 ' + ('AA:' * 31) + 'AA',
        'a=setup:active',
        'a=mid:0',
        'a=sendonly',
        'a=msid:dashcam video0',
        'a=rtpmap:96 H264/90000',
        'a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f'
    ]
    
    # Combine into full SDP
    sdp = '\r\n'.join(session_lines) + '\r\n' + '\r\n'.join(video_section)
    return RTCSessionDescription(sdp=sdp, type="answer")

def parse_ice_candidate(data):
    """Parse ICE candidate from client data"""
    try:
        candidate_str = data.get("candidate", "")
        sdp_mid = data.get("sdpMid", "")
        sdp_m_line_index = data.get("sdpMLineIndex", 0)
        
        # Validate candidate string
        if not candidate_str:
            logger.warning("Empty ICE candidate, ignoring")
            return None
        
        # Parse candidate components
        parts = candidate_str.split()
        
        if len(parts) >= 8 and parts[0].startswith('candidate:'):
            foundation = parts[0].split(':')[1]
            component = int(parts[1])
            protocol = parts[2].lower()
            priority = int(parts[3])
            ip = parts[4]
            port = int(parts[5])
            candidate_type = parts[7]
            
            # Create RTCIceCandidate object
            return RTCIceCandidate(
                component=component,
                foundation=foundation,
                ip=ip,
                port=port,
                priority=priority,
                protocol=protocol,
                type=candidate_type,
                sdpMid=sdp_mid,
                sdpMLineIndex=sdp_m_line_index
            )
        else:
            logger.warning(f"Unrecognized ICE candidate format: {candidate_str}")
            return None
    except Exception as e:
        logger.error(f"Error parsing ICE candidate: {str(e)}")
        return None
