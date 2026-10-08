import { Redirect } from 'expo-router';

/** The app's home is Explore (DECISIONS S13); the site's homepage is for people without the app. */
export default function IndexRoute() {
  return <Redirect href="/explore" />;
}
