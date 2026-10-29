export type AttendingLocale = 'en' | 'es';

export type AttendeePhotoSource = 'hashpass' | 'upload' | 'initials';

export interface AttendingArtworkTemplate {
  backgroundSrc: string | null;
  accentColor: string;
  secondaryAccentColor: string;
  flagColors: string[];
  hashtags: string[];
  poweredByLogoSrc: string;
}

export interface AttendingEventData {
  slug: string;
  id: string;
  name: string;
  shortName: string;
  city: string;
  country: string;
  venue: string;
  color: string;
  logoSrc: string;
  startDate: string | null;
  endDate: string | null;
  dateFallback: string | null;
  website: string;
  artworkTemplate: AttendingArtworkTemplate;
}

export interface AttendingArtworkOptions {
  eventName: string;
  shortName: string;
  location: string;
  venue: string;
  dateLabel: string;
  attendeeName: string;
  attendeeRole: string;
  logoSrc: string;
  avatarSrc: string | null;
  artworkTemplate: AttendingArtworkTemplate;
  poweredByLabel: string;
  pastEvent: boolean;
  intentions: {
    upcoming: string;
    past: string;
    emptyName: string;
  };
}
