import { ApplyPostAnswerResponseStatus, LinkedInPostResponseDto, PostLinkedInRelativeDateFormat } from "domains/post/post.dto";
import { GetTargetUserLinkedInProfileSuccessResponseDto } from "domains/target-user/target-user.dto";
import {
  LoginLinkedInUserDbStatus,
  LogoutLinkedInUserResponseStatus,
  UserLinkedInCommonError,
  UserLinkedinProfileAbout,
} from "domains/user/user.dto";
import { WebElement } from "selenium-webdriver";
import { IBrowserLogsService } from "services/browser-logs/browser-logs.service.interface";
import { IWebDriverService } from "services/web-driver/extended-web-driver.service.interface";
import { FlowTypes } from "types/common-types";

export interface ILinkedInService {
  // ------------------------------- Sign in/sign out flows -------------------------------

  /** Enters login credentials, attempts to log in, checks verification, and returns status */
  login(
    driver: IWebDriverService,
    email: string,
    password: string,
    flowType: FlowTypes,
    requestId: string,
  ): Promise<LoginLinkedInUserDbStatus>;
  /** Clicks menu and logs out */
  logout(driver: IWebDriverService): Promise<LogoutLinkedInUserResponseStatus | UserLinkedInCommonError>;
  /** Opens our user's profile page */
  showUserProfile(
    driver: IWebDriverService,
    email: string,
    flowType: FlowTypes,
    requestId: string,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<void>;
  /** Performs random actions on pages for disguise */
  additionalRandomActionsForSecrecy(driver: IWebDriverService): Promise<void>;

  // ------------------------------- Collecting target user data -------------------------------

  /** Collects user data from the page */
  profileDataFetchLess<T extends "login" | "getTargetUserProfileData">(
    driver: IWebDriverService,
    scenario: T,
    email?: string,
    countryCode?: string,
    cityCode?: string,
  ): Promise<T extends "login" ? UserLinkedinProfileAbout : GetTargetUserLinkedInProfileSuccessResponseDto["user_data"]>;

  // ------------------------------- Collecting posts -------------------------------

  /** Generates a search URL for new post collection */
  generateSearchPostUrl(ids: string[], daysCount: number): string;
  /** Returns pagination info from search results */
  extractSearchPagination(driver: IWebDriverService): Promise<{ currentPage: number; totalPages: number } | null>;
  /** Collects post data, identifies its type, and creates a LinkedInPostResponseDto */
  searchPostData(
    driver: IWebDriverService,
    post: WebElement,
    email: string,
    flowType: FlowTypes.GET_TARGET_USER_NEW_POST | FlowTypes.GET_SEARCHED_NEW_POST,
    crmPayload: Record<string, any>,
    postId: string,
    activityText: string,
    postNumericDate: PostLinkedInRelativeDateFormat,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<LinkedInPostResponseDto | null>;
  /** Validates post data */
  validatePostData(postData: LinkedInPostResponseDto | null): Promise<{ isValidPost: boolean; errorMessage?: string }>;
  /** Extracts post date (3d, 1w...) */
  getDateFromPost(
    post: WebElement,
    postId: string,
    crmPayload: Record<string, any>,
    email: string,
    flowType: FlowTypes,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<string>;
  /** Returns the name and avatar URL of our user */
  getUserDataFromMeMenu(driver: IWebDriverService): Promise<{ userName: string; userAvatar: string; userLinkedinUrl: string }>;
  /** Collects user data from recent-activity page */
  recentActivityAbout(driver: IWebDriverService): Promise<GetTargetUserLinkedInProfileSuccessResponseDto["user_data"]>;
  /** Returns post ID, or an empty string if not found */
  getPostId(post: WebElement): Promise<string>;
  /** Changes LinkedIn profile language to EN, returns 1 on success, 0 on error */
  changeLanguage(
    driver: IWebDriverService,
    email: string,
    crmPayload: Record<string, any>,
    flowType: FlowTypes,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<number>;
  /** Randomly scrolls to the last element */
  scrollThroughElements(driver: IWebDriverService, elements: WebElement[]): Promise<void>;
  /** Determines if the post is an empty repost */
  isRepost(post: WebElement): Promise<boolean>;
  /** Checks whether comments are disabled */
  areCommentsDisabled(post: WebElement): Promise<boolean>;
  /** Extracts prospectId from the post */
  getProspectIdAndUrlFromPost(post: WebElement): Promise<{ prospectId: string; prospectUrl: string }>;
  /** Collects user "about" data from the post */
  getProspectAboutFromPost(post: WebElement): Promise<GetTargetUserLinkedInProfileSuccessResponseDto["user_data"]["about"]>;
  /** Loads more posts and waits until at least three are loaded */
  loadMorePosts(driver: IWebDriverService, posts: WebElement[]): Promise<void>;

  // ------------------------------- Comment on post -------------------------------

  /** Applies a specific like to the post */
  likePost(
    driver: IWebDriverService,
    likePostType: string,
    email: string,
    flowType: FlowTypes,
    crmPayload: Record<string, any>,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<ApplyPostAnswerResponseStatus | UserLinkedInCommonError>;
  /** Comments on a post. Returns status: either success or unexpected_html_layout */
  commentOnPost(
    driver: IWebDriverService,
    comment: string,
    email: string,
    flowType: FlowTypes,
    crmPayload: Record<string, any>,
  ): Promise<ApplyPostAnswerResponseStatus | UserLinkedInCommonError>;

  // ------------------------------- Common -------------------------------

  /** Checks whether the user is logged in */
  checkLogin(driver: IWebDriverService): Promise<boolean>;
  /** Accepts data privacy policy if prompted */
  acceptDataPrivacyPolicy(driver: IWebDriverService): Promise<void>;
  /** Closes message pop-ups */
  closeMessageBoxes(driver: IWebDriverService): Promise<void>;
}

export namespace ILinkedInService {
  export const INTERFACE_NAME = "ILinkedInService";
}
