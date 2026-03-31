
/**
 * Date utility functions for handling Google Sheets date formats
 */

// Helper to format Date to ISO string for Sheets (prevents locale confusion)
export const formatToSheetDate = (date: Date) => {
    // Using ISO format (YYYY-MM-DDTHH:mm:ss.sssZ) ensures Google Sheets 
    // parses it correctly as a date/time regardless of locale settings
    return date.toISOString();
};

// Convert Google Sheets serial number to JS Date
// Google Sheets starts from Dec 30, 1899
export const convertSerialToDate = (serial: number): Date => {
    const fractionalDay = serial - Math.floor(serial) + 0.0000001;
    const totalSeconds = Math.floor(86400 * fractionalDay);
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);

    // Sheets serials are relative to 1899-12-30. 
    // We treat the serial as a UTC wall-clock and then adjust for IST offset.
    const date = new Date(Date.UTC(1899, 11, 30));
    date.setUTCDate(date.getUTCDate() + Math.floor(serial));
    date.setUTCHours(hours, minutes, seconds);

    // Subtract IST offset (5.5 hours) to get the true UTC instant
    return new Date(date.getTime() - (5.5 * 60 * 60 * 1000));
};

// Helper to parse DD/MM/YYYY HH:mm:ss OR Serial Number back to ISO string for frontend
export const parseSheetDate = (dateInput: string | number | null | undefined) => {
    if (dateInput === null || dateInput === undefined) return null;

    try {
        // Handle Serial Number (from UNFORMATTED_VALUE)
        if (typeof dateInput === 'number') {
            const date = convertSerialToDate(dateInput);
            return isNaN(date.getTime()) ? null : date.toISOString();
        }

        const dateStr = String(dateInput).trim();
        if (!dateStr) return null;

        // If it's already an ISO string or looks like one, return it
        if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date.toISOString();
        }

        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart) return null;

        // Handle DD/MM/YYYY or MM/DD/YYYY (Ambiguous)
        if (datePart.includes('/')) {
            const parts = datePart.split('/').map(Number);
            if (parts.length === 3) {
                // If the first part is > 12, it MUST be DD/MM/YYYY
                // Otherwise, it's ambiguous. For this project, we've been using DD/MM/YYYY as canonical
                // BUT many strings in the sheet might be US MM/DD/YYYY.
                // For now, we stick to our canonical DD/MM/YYYY for strings.
                const [d, m, y] = parts;
                const h_val = timePart ? Number(timePart.split(':')[0]) : 0;
                const min_val = timePart ? Number(timePart.split(':')[1]) : 0;
                const s_val = timePart ? Number(timePart.split(':')[2]) : 0;

                // Construct as IST string to ensure consistent parsing across timezones
                const isoStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h_val || 0).padStart(2, '0')}:${String(min_val || 0).padStart(2, '0')}:${String(s_val || 0).padStart(2, '0')}+05:30`;
                const dateObj = new Date(isoStr);
                return isNaN(dateObj.getTime()) ? null : dateObj.toISOString();
            }
        }

        // Handle YYYY-MM-DD
        if (datePart.includes('-')) {
            // If it has time but no timezone, assume IST
            if (dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('+')) {
                const [dPart, tPart] = dateStr.split(' ');
                const isoStr = `${dPart}T${tPart}+05:30`;
                const date = new Date(isoStr);
                return isNaN(date.getTime()) ? null : date.toISOString();
            }
            // Fallback for simple date or already formatted ISO
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date.toISOString();
        }

        return null;
    } catch (e) {
        return null;
    }
};

// Helper to normalized date string to YYYY-MM-DD
export const normalizeDate = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();
    // If it's the new Full format, extract just the date part for comparison
    if (cleanStr.includes(' ')) {
        const parts = cleanStr.split(' ')[0].split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }

    // Handle DD/MM/YYYY or DD-MM-YYYY
    if (cleanStr.includes('/') || cleanStr.includes('-')) {
        const parts = cleanStr.split(/[\/\-]/);
        if (parts.length === 3) {
            // Check if it looks like DD/MM/YYYY (day is first part)
            if (parts[0].length <= 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            // Check if it looks like YYYY-MM-DD
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
    }
    return cleanStr;
};

// Helper to ensure valid ISO string date
export const ensureIsoDate = (dateStr: string | number | null | undefined): string | undefined => {
    if (dateStr === null || dateStr === undefined || dateStr === '') return undefined;
    const parsed = parseSheetDate(dateStr);
    return parsed || undefined;
}

// Helper function to parse various date formats (DD/MM/YYYY, ISO, Serial, etc.) strictly as DD/MM/YYYY for ambiguous cases
export const parseDateString = (dateStr: string | number | null | undefined): Date | null => {
    if (dateStr === null || dateStr === undefined) return null;

    // Handle Serial Number (if UNFORMATTED_VALUE slips in)
    if (typeof dateStr === 'number') {
        const date = convertSerialToDate(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    const cleanStr = String(dateStr).trim();
    if (!cleanStr) return null;

    // Remove leading single quote if present
    const finalStr = cleanStr.startsWith("'") ? cleanStr.substring(1) : cleanStr;

    // Handle DD/MM/YYYY or D/M/YYYY with time
    const ddmmyyyyMatch = finalStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (ddmmyyyyMatch) {
        const [_, day, month, year, hours, minutes, seconds] = ddmmyyyyMatch;
        // Construct as IST string
        const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${(hours || '00').padStart(2, '0')}:${(minutes || '00').padStart(2, '0')}:${(seconds || '00').padStart(2, '0')}+05:30`;
        const date = new Date(isoStr);
        return isNaN(date.getTime()) ? null : date;
    }

    // Handle YYYY-MM-DDTHH:mm or ISO strings without timezone
    if (finalStr.includes('T') && !finalStr.includes('+') && !finalStr.endsWith('Z')) {
        const date = new Date(finalStr + '+05:30');
        if (!isNaN(date.getTime())) return date;
    }

    // Fallback to ISO/Regular parsing (but be wary of MM/DD/YYYY ambiguity)
    const date = new Date(finalStr);
    return isNaN(date.getTime()) ? null : date;
};

// Helper to strictly format a Date object to DD/MM/YYYY HH:mm:ss string
export const formatDateToString = (date: Date | null | undefined): string => {
    if (!date || isNaN(date.getTime())) return '';

    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');

    return `${d}/${m}/${y} ${h}:${min}:${s}`;
};

// Helper to get today's date in IST (UTC+5:30) as YYYY-MM-DD
export const getIstDateString = () => {
    const now = new Date();
    // Use Intl to get formatted date in Asia/Kolkata
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(now); // Returns YYYY-MM-DD
};
