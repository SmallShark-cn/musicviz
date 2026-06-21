import 'MusicLibrary/music_library.dart';

Map<String, String> cookie = {};

void main() {
  final kuGou = KuGouMusicApi(env: KugouProcessEnv(platform: KugouPlatform.lite));
  kuGou.set_cookie(cookie);
  // final topSongs = kuGou.top_song();
  // print(topSongs);
  // final userDetail = kuGou.user_detail();
  // print(userDetail);
  final songUrl = kuGou.song_url("611E8F05F5D68636F40A08B1B5E6F2D5", quality: "320");
  print(songUrl);
}
