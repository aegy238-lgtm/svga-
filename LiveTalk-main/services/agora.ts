
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack } from "agora-rtc-sdk-ng";

const APP_ID = "9209e41821f34b4bb3d5bc8391d86cdc";

class AgoraService {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    
    // إعداد المستمعين للأصوات البعيدة
    this.client.on("user-published", async (user, mediaType) => {
      if (mediaType === "audio") {
        await this.client?.subscribe(user, mediaType);
        user.audioTrack?.play();
      }
    });

    this.client.on("user-unpublished", (user) => {
      user.audioTrack?.stop();
    });

    this.isInitialized = true;
  }

  async join(channelName: string, uid: string) {
    await this.init();
    try {
      // الانضمام للقناة (بدون توكن للوضع التجريبي كما في App ID المقدم)
      await this.client?.join(APP_ID, channelName, null, uid);
      console.log("Joined Agora Channel:", channelName);
    } catch (e) {
      console.error("Agora Join Error:", e);
    }
  }

  async publishAudio() {
    try {
      if (!this.localAudioTrack) {
        this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
          AEC: true, ANS: true, AGC: true // تحسينات جودة الصوت
        });
      }
      await this.client?.publish(this.localAudioTrack);
      console.log("Audio Published");
    } catch (e) {
      console.error("Agora Publish Error:", e);
    }
  }

  async unpublishAudio() {
    try {
      if (this.localAudioTrack) {
        await this.client?.unpublish(this.localAudioTrack);
        this.localAudioTrack.stop();
        this.localAudioTrack.close();
        this.localAudioTrack = null;
        console.log("Audio Unpublished");
      }
    } catch (e) {
      console.error("Agora Unpublish Error:", e);
    }
  }

  async setMute(muted: boolean) {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setEnabled(!muted);
    }
  }

  async leave() {
    await this.unpublishAudio();
    await this.client?.leave();
    console.log("Left Agora Channel");
  }
}

export const agoraService = new AgoraService();
