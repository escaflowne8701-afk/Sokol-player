// public/js/services/xmltvService.js - EPG parsing
export function parseXMLTV(xmlText) {
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    
    // Check for parsing errors
    const parserError = xml.querySelector('parsererror');
    if (parserError) {
      console.error('XMLTV parsing error:', parserError.textContent);
      return {};
    }
    
    const programmes = {};
    
    xml.querySelectorAll("programme").forEach(p => {
      const channel = p.getAttribute("channel");
      if (!channel) return;
      
      if (!programmes[channel]) programmes[channel] = [];
      
      const titleEl = p.querySelector("title");
      const descEl = p.querySelector("desc");
      const categoryEl = p.querySelector("category");
      const iconEl = p.querySelector("icon");
      
      programmes[channel].push({
        start: p.getAttribute("start"),
        stop: p.getAttribute("stop"),
        title: titleEl?.textContent || "",
        description: descEl?.textContent || "",
        category: categoryEl?.textContent || "",
        icon: iconEl?.getAttribute("src") || ""
      });
    });
    
    return programmes;
  } catch (error) {
    console.error('Failed to parse XMLTV:', error);
    return {};
  }
}

// Helper to format time
export function formatEPGTime(timeStr) {
  if (!timeStr) return '';
  // Format YYYYMMDDHHMMSS to readable time
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${hour}:${minute}`;
  }
  return timeStr;
}

// Get current program for a channel
export function getCurrentProgram(channelProgrammes) {
  if (!channelProgrammes || !channelProgrammes.length) return null;
  
  const now = Date.now();
  
  for (const program of channelProgrammes) {
    const startTime = parseEPGTimeToDate(program.start);
    const endTime = parseEPGTimeToDate(program.stop);
    
    if (startTime && endTime && now >= startTime.getTime() && now <= endTime.getTime()) {
      return program;
    }
  }
  
  return null;
}

function parseEPGTimeToDate(timeStr) {
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (match) {
    const [, year, month, day, hour, minute, second] = match.map(Number);
    return new Date(year, month - 1, day, hour, minute, second || 0);
  }
  return null;
}