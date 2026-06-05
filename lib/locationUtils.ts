/**
 * Calculates the distance between two points on the Earth's surface using the Haversine formula.
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    return distance;
}

/**
 * Parses a "lat, long" string into an object with lat and long properties.
 * @param latLongStr "latitude, longitude" string
 * @returns { lat: number, long: number } | null
 */
export function parseLatLong(latLongStr: any): { lat: number; long: number } | null {
    if (!latLongStr) return null;

    let locStr = typeof latLongStr === 'string' ? latLongStr : '';
    
    if (typeof latLongStr === 'object') {
        locStr = latLongStr.location1 || '';
    } else if (typeof latLongStr === 'string' && latLongStr.startsWith('{')) {
        try {
            const parsed = JSON.parse(latLongStr);
            locStr = parsed.location1 || '';
        } catch(e) {}
    }

    if (!locStr) return null;

    // Split by comma, slash or space
    const parts = locStr.split(/[,\/ ]+/).map((p) => parseFloat(p.trim())).filter(p => !isNaN(p));
    if (parts.length >= 2) {
        return { lat: parts[0], long: parts[1] };
    }
    return null;
}

/**
 * Parses all valid "lat, long" strings from an object or JSON string.
 * @returns Array of { lat: number, long: number }
 */
export function parseAllLatLongs(latLongStr: any): { lat: number; long: number }[] {
    if (!latLongStr) return [];

    let loc1 = '';
    let loc2 = '';
    
    if (typeof latLongStr === 'object') {
        loc1 = latLongStr.location1 || '';
        loc2 = latLongStr.location2 || '';
    } else if (typeof latLongStr === 'string') {
        if (latLongStr.startsWith('{')) {
            try {
                const parsed = JSON.parse(latLongStr);
                loc1 = parsed.location1 || '';
                loc2 = parsed.location2 || '';
            } catch(e) {}
        } else {
            loc1 = latLongStr;
        }
    }

    const parseSingle = (str: string) => {
        if (!str) return null;
        const parts = str.split(/[,\/ ]+/).map((p) => parseFloat(p.trim())).filter(p => !isNaN(p));
        if (parts.length >= 2) return { lat: parts[0], long: parts[1] };
        return null;
    };

    const results = [];
    const p1 = parseSingle(loc1);
    if (p1) results.push(p1);
    const p2 = parseSingle(loc2);
    if (p2) results.push(p2);

    return results;
}

/**
 * Calculates the bearing between two points.
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const bearing = ((θ * 180) / Math.PI + 360) % 360;
    return bearing;
}

/**
 * Converts degrees to a compass direction.
 */
export function getCompassDirection(bearing: number): string {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
}
