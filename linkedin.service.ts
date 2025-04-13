/* Demo fragment */

import { By, Key, until, WebElement } from "selenium-webdriver";
import { ILinkedInService } from "./linkedin.service.interface";
import {
  LoginLinkedInUserDbStatus,
  LoginLinkedInUserResponseStatus,
  LogoutLinkedInUserResponseStatus,
  UserLinkedInCommonError,
  UserLinkedInLoginVerificationType,
  UserLinkedinProfileAbout,
} from "domains/user/user.dto";
import { FlowTypes } from "types/common-types";
import { Inject } from "@nestjs/common";
import { IMessageSenderService } from "services/message-sender/message-sender.service.interface";
import { GetTargetUserLinkedInProfileSuccessResponseDto } from "domains/target-user/target-user.dto";
import { IDateTranslateService } from "services/date-translate/date-translate.service.interface";
import {
  ActivityType,
  ApplyPostAnswerResponseStatus,
  LinkedInPostResponseDto,
  PostLinkedInRelativeDateFormat,
} from "domains/post/post.dto";
import { Post } from "domains/post/post.entity";
import { ILoggerService } from "services/logger/logger.service.interface";
import WebDriverUtils from "utils/web-driver.utils";
import FunctionUtils from "utils/function.util";
import { IWebDriverService } from "services/web-driver/extended-web-driver.service.interface";
import { POST_URL_TEMPLATES } from "configs/post";
import StringUtils from "utils/string.util";
import { IBrowserLogsService } from "services/browser-logs/browser-logs.service.interface";

export class LinkedInServiceImpl implements ILinkedInService {
  constructor(
    @Inject(IMessageSenderService.INTERFACE_NAME) private telegramMessageSenderService: IMessageSenderService,
    @Inject(IDateTranslateService.INTERFACE_NAME) private dateTranslateService: IDateTranslateService,
    @Inject(ILoggerService.INTERFACE_NAME) private loggerService: ILoggerService,
  ) {}
  public async login(
    driver: IWebDriverService,
    email: string,
    password: string,
    flowType: FlowTypes,
    requestId: string,
  ): Promise<LoginLinkedInUserDbStatus> {
    try {
      await WebDriverUtils.clickWhenVisible(driver, '[class="signin-other-account"]');
      await WebDriverUtils.waitWithMouseMovements(driver, "medium");
    } catch (error) {
    }

    try {
      const checkbox = await driver.findElement(By.css('input[id*="remember"]'));
      const checkboxValue = await checkbox.getAttribute("value");

      if (checkboxValue === "true") {
        const parentDiv = await checkbox.findElement(By.xpath(".."));
        await WebDriverUtils.performCustomClick(driver, parentDiv);
        await WebDriverUtils.waitRandomInterval("small");
      }
    } catch {}

    try {
      const emailField = await driver.findElement(By.id("username"));
      const passwordField = await driver.findElement(By.id("password"));
      const signInButton = await driver.findElement(By.css("div.login__form_action_container  button"));

      await WebDriverUtils.performCustomClick(driver, emailField);
      await WebDriverUtils.humanLikeTyping(emailField, email);
      await WebDriverUtils.waitRandomInterval("small");

      await WebDriverUtils.performCustomClick(driver, passwordField);
      await WebDriverUtils.humanLikeTyping(passwordField, password);
      await WebDriverUtils.waitRandomInterval("small");

      await WebDriverUtils.performCustomClick(driver, signInButton);
    } catch (error) {
      await this.telegramMessageSenderService.sendReport(
        email,
        flowType,
        UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT,
        { requestId: requestId },
        "unexpected_html_layout for the account",
      );
      return UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT;
    }

    await WebDriverUtils.waitWithMouseMovements(driver, "long");

    try {
      await WebDriverUtils.waitWithMouseMovements(driver, "small");
      await this.waitCaptchaSolver(driver).catch(() => {});

      await this.waitCaptchaSolver(driver).catch(() => {});
    } catch {
    }

    try {
      await driver.findElement(By.css("#input__email_verification_pin"));
      return UserLinkedInLoginVerificationType.EMAIL;
    } catch {
    }

    try {
      const headerText = await driver.findElement(By.css('h1[class="content__header"]')).getText();
      if (headerText.includes("authenticator app")) {
        return UserLinkedInLoginVerificationType.TWO_FA_AUTHENTICATOR;
      }
    } catch {
    
    }

    try {
      await driver.findElement(By.css("#input__phone_verification_pin"));
      return UserLinkedInLoginVerificationType.SMS;
    } catch {
    }

    try {
      await driver.findElement(By.css(".header__content__heading__inapp"));
      return UserLinkedInLoginVerificationType.APP;
    } catch {
    }

    try {
      await driver.findElement(By.css('form[id="register-phone-challenge"]'));
      return LoginLinkedInUserResponseStatus.PHONE_NUMBER_VERIFICATION;
    } catch {
    }

    try {
      await driver.findElement(By.css("#captcha-internal"));
      return LoginLinkedInUserResponseStatus.CAPTCHA;
    } catch {
    }

    await WebDriverUtils.waitWithMouseMovements(driver, "small");

    try {
      try {
        const errorElement = await driver.findElement(By.css("#error-for-username"));
        await driver.wait(until.elementIsVisible(errorElement), 500);
        return LoginLinkedInUserResponseStatus.WRONG_EMAIL_OR_PASSWORD;
      } catch {
        const errorElement = await driver.findElement(By.css("#error-for-password"));
        await driver.wait(until.elementIsVisible(errorElement), 500);
        return LoginLinkedInUserResponseStatus.WRONG_EMAIL_OR_PASSWORD;
      }
    } catch {
      if ((await driver.getCurrentUrl()).includes("feed")) {
        return LoginLinkedInUserResponseStatus.SUCCESS;
      } else {
        try {
          const restrictedText = await driver.findElement(By.css(".app__content h1")).getText();
          if (restrictedText.includes("restricted")) {
            return LoginLinkedInUserResponseStatus.ACCOUNT_RESTRICTED;
          }
        } catch {
        }
        await this.telegramMessageSenderService.sendReport(
          email,
          flowType,
          UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT,
          { requestId: requestId },
          `unexpected_html_layout for the account a new challenge type appeared at page url: ${await driver.getCurrentUrl()}`,
        );
        return UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT;
      }
    }
  }

  private async waitCaptchaSolver(driver: IWebDriverService): Promise<void> {
    await driver.findElement(By.css("#captcha-internal"));
    await FunctionUtils.sleepRandom(58000, 62000);
  }

  public async logout(driver: IWebDriverService): Promise<LogoutLinkedInUserResponseStatus | UserLinkedInCommonError> {
    let status: LogoutLinkedInUserResponseStatus | UserLinkedInCommonError = LogoutLinkedInUserResponseStatus.SUCCESS;
    try {
      await WebDriverUtils.clickWhenVisible(
        driver,
        "button.global-nav__primary-link.global-nav__primary-link-me-menu-trigger.artdeco-dropdown__trigger.artdeco-dropdown__trigger--placement-bottom.ember-view",
      );
    } catch {
      status = UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT;
      return status;
    }

    await FunctionUtils.sleepRandom(400, 600);

    try {
      await WebDriverUtils.clickWhenVisible(driver, "a.global-nav__secondary-link.mv1");
    } catch (error) {
      status = UserLinkedInCommonError.UNEXPECTED_HTML_LAYOUT;
      return status;
    }

    await WebDriverUtils.waitRandomInterval("small");
    return status;
  }

  public async showUserProfile(
    driver: IWebDriverService,
    email: string,
    flowType: FlowTypes,
    requestId: string,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<void> {
    if ((await driver.getCurrentUrl()).includes("connect-services")) {
      await this.acceptDataPrivacyPolicy(driver);
      await WebDriverUtils.waitWithMouseMovements(driver, "medium");
    }

    try {
      await WebDriverUtils.clickWhenVisible(
        driver,
        "button.global-nav__primary-link.global-nav__primary-link-me-menu-trigger.artdeco-dropdown__trigger.artdeco-dropdown__trigger--placement-bottom.ember-view",
        60000,
      );
      await FunctionUtils.sleepRandom(400, 600);

      await WebDriverUtils.clickWhenVisible(driver, ".artdeco-entity-lockup__title.ember-view", 60000);
    } catch (error: any) {
      await this.telegramMessageSenderService.sendReport(
        email,
        flowType,
        "status is success, but the about will be empty. Check menu open selector",
        { requestId: requestId },
        `user_profile showed error: ${error?.message}`,
      );

      if (browserLogsService) {
        browserLogsService.stopLogging();
        await browserLogsService.makeLog(true);
        await browserLogsService.saveLogsToStorage();

        browserLogsService.startLogging(true);
      }
    }
  }

  public additionalRandomActionsForSecrecy = async (driver: IWebDriverService): Promise<void> => {
    try {
      await WebDriverUtils.waitWithMouseMovements(driver, "medium");

      const pagesUrlsArr: string[] = [
        "https://www.linkedin.com/mynetwork/",
        "https://www.linkedin.com/mynetwork/invite-connect/connections/",
        "https://www.linkedin.com/mynetwork/network-manager/people-follow/following/",
        "https://www.linkedin.com/mynetwork/network-manager/people-follow/followers/",
        "https://www.linkedin.com/groups/",
        "https://www.linkedin.com/groups/requests/",
        "https://www.linkedin.com/jobs/",
        "https://www.linkedin.com/events/",
        "https://www.linkedin.com/mynetwork/network-manager/company/",
        "https://www.linkedin.com/mynetwork/network-manager/newsletters/",
        "https://www.linkedin.com/mynetwork/network-manager/hashtags/",
      ];

      const randomPageIndex = Math.floor(Math.random() * pagesUrlsArr.length);
      const randomPageUrl = pagesUrlsArr[randomPageIndex];

      await WebDriverUtils.goToTargetUrl(driver, randomPageUrl);
      await WebDriverUtils.scrollPageByRandomHeight(driver);
      await WebDriverUtils.waitWithMouseMovements(driver, "small");
      await WebDriverUtils.scrollPageByRandomHeight(driver);
      await WebDriverUtils.waitWithMouseMovements(driver, "small");
    } catch {}
  };

  // ------------------------------- Collecting target user data -------------------------------

  public async profileDataFetchLess<T extends "login" | "getTargetUserProfileData">(
    driver: IWebDriverService,
    scenario: T,
    email: string = "",
    countryCode: string = "",
    cityCode: string = "",
  ): Promise<T extends "login" ? Required<UserLinkedinProfileAbout> : GetTargetUserLinkedInProfileSuccessResponseDto["user_data"]> {
    await WebDriverUtils.waitWithMouseMovements(driver, "small");

    let profileName: string;
    try {
      profileName = await driver.findElement(By.css("div.mt2.relative a h1")).getText();
    } catch (error) {
      profileName = "";
    }

    let backgroundImage: string;
    try {
      backgroundImage = await driver.findElement(By.css("div.profile-background-image__image-container img")).getAttribute("src");
    } catch (error) {
      backgroundImage = "";
    }

    let profileImage: string;
    try {
      profileImage = await driver.findElement(By.css("div.pv-top-card--photo img")).getAttribute("src");
      if (profileImage.includes("data:image")) {
        profileImage = "";
      }
    } catch (error) {
      try {
        profileImage = await driver.findElement(By.css("div.pv-top-card__non-self-photo-wrapper.ml0 button img")).getAttribute("src");
        if (profileImage.includes("data:image")) {
          profileImage = "";
        }
      } catch (error) {
        try {
          profileImage = await driver.findElement(By.css("div.profile-photo-edit.pv-top-card__edit-photo button img")).getAttribute("src");
          if (profileImage.includes("data:image")) {
            profileImage = "";
          }
        } catch (innerError) {
          profileImage = "";
        }
      }
    }

    let profileDescription: string;
    try {
      profileDescription = await driver.findElement(By.css("div.mt2.relative div.text-body-medium.break-words")).getText();
    } catch (error) {
      profileDescription = "";
    }

    const linkedInId: string = await this.getProspectLinkedInId(driver);

    if (scenario === "login") {
      const userData = {
        about: {
          name: profileName,
          headline: profileDescription,
          prospect_image: profileImage,
          background_image: backgroundImage,
          profile_url: StringUtils.removeSlashOnEnd(await driver.getCurrentUrl()),
          email: email,
          country_code: countryCode,
          city_code: cityCode,
        },
      };

      return userData as T extends "login"
        ? Required<UserLinkedinProfileAbout>
        : GetTargetUserLinkedInProfileSuccessResponseDto["user_data"];
    } else {
      const userData = {
        about: {
          name: profileName,
          headline: profileDescription,
          prospect_image: profileImage,
          background_image: backgroundImage,
          prospect_is_active: true,
          profile_url: StringUtils.removeSlashOnEnd(await driver.getCurrentUrl()),
          linkedInId,
        },
      };

      return userData as T extends "login"
        ? Required<UserLinkedinProfileAbout>
        : GetTargetUserLinkedInProfileSuccessResponseDto["user_data"];
    }
  }

  private async getProspectLinkedInId(driver: IWebDriverService): Promise<string> {
    try {
      const linkElements = await driver.findElements(
        By.css(
          '.pvs-list__footer-wrapper a[href*="profile%3A"], a[data-field*="position_contextual_skills_see_details"][href*="profile%3A"]',
        ),
      );
      const prospectLink = await linkElements[0].getAttribute("href");
      const prospectId = prospectLink.split("profile%3A")[1].split(/[?&]/)[0];
      return prospectId;
    } catch {}
    return "";
  }

  // ------------------------------- Collecting posts -------------------------------

  public generateSearchPostUrl(ids: string[], daysCount: number): string {
    const basePath = "https://www.linkedin.com/search/results/content/";

    let datePosted = "";
    if (daysCount === 1) {
      datePosted = '"past-24h"';
    } else if (daysCount > 1 && daysCount <= 7) {
      datePosted = '"past-week"';
    } else if (daysCount > 7 && daysCount <= 31) {
      datePosted = '"past-month"';
    }

    const params = new URLSearchParams({
      datePosted,
      fromMember: JSON.stringify(ids),
      origin: "FACETED_SEARCH",
      sortBy: '"date_posted"',
    });

    return `${basePath}?${params.toString()}`;
  }
  public async searchPostData(
    driver: IWebDriverService,
    post: WebElement,
    email: string,
    flowType: FlowTypes.GET_TARGET_USER_NEW_POST | FlowTypes.GET_SEARCHED_NEW_POST,
    crmPayload: Record<string, any>,
    postId: string,
    activityText: string,
    postNumericDate: PostLinkedInRelativeDateFormat,
    browserLogsService: IBrowserLogsService | null,
  ): Promise<LinkedInPostResponseDto | null> {
    const repostData: LinkedInPostResponseDto["repost_data"] = {
      name: "",
      headline: "",
      numeric_date: {} as PostLinkedInRelativeDateFormat,
      profile_pic_url: "",
      postUrl: "",
    };

    let postType: LinkedInPostResponseDto["post_data"];
    try {
      postType = await this.identifyPost(post, driver);
    } catch {
      return null;
    }

    const postUrl = this.getPostUrl(postId);
    const likeCount = await this.getLikesCount(post);
    try {
      let postText = "";
      let repostText = "";

      const repost = await post.findElement(By.css("div.feed-shared-update-v2__update-content-wrapper.artdeco-card"));

      try {
        repostText = await repost
          .findElement(By.css("div.update-components-text.relative.update-components-update-v2__commentary"))
          .getAttribute("innerText");
      } catch {
        repostText = "";
      }

      try {
        postText = await post
          .findElement(By.css("div.update-components-text.relative.update-components-update-v2__commentary"))
          .getAttribute("innerText");
      } catch {
        postText = "";
        if (postType.post_type !== Post.PayloadType.TEXT_WITH_JOB_VACANCY) {
          await this.telegramMessageSenderService.sendReport(
            email,
            flowType,
            `post text is not get please check this post: ${postId}`,
            crmPayload,
            postUrl,
          );

          if (browserLogsService) {
            browserLogsService.stopLogging();
            await browserLogsService.makeLog(true);
            await browserLogsService.saveLogsToStorage();
            browserLogsService.startLogging(true);
          }
        }
      }

      try {
        repostData.name = (await repost.findElement(By.css("span.update-components-actor__title")).getText()).split("\n")[0];
      } catch {
        const authorNameElement = await post
          .findElement(
            By.css('div[class="ember-view update-components-mini-update-v2 feed-shared-update-v2__update-content-wrapper artdeco-card"]'),
          )
          .findElement(By.css(' div[class="update-components-actor__meta relative"] a span span'));

        repostData.name = (await authorNameElement.getText()).split("\n")[0];
      }

      const headlineSelectors = [
        ".update-components-actor__description.t-black--light.text-body-xsmall",
        ".update-components-actor__description.t-black--light.t-12.t-normal",
      ];

      for (const selector of headlineSelectors) {
        try {
          const element = await repost.findElement(By.css(selector));
          repostData.headline = (await element.getAttribute("innerText")).split("\n")[0];
          break; 
        } catch {
        
        }
      }

      const profilePicSelectors = [
        ".ivm-view-attr__img-wrapper.display-flex img",
        ".ivm-image-view-model.update-components-actor__avatar .ivm-view-attr__img-wrapper.ivm-view-attr__img-wrapper--no-flex img",
        ".ivm-image-view-model.update-components-actor__avatar .ivm-view-attr__img-wrapper img",
      ];

      for (const selector of profilePicSelectors) {
        try {
          const element = await repost.findElement(By.css(selector));
          repostData.profile_pic_url = await element.getAttribute("src");
          break; 
        } catch {
          
        }
      }
      const repostDate = await this.getDateFromPost(repost, postId, crmPayload, email, flowType, browserLogsService);
      repostData.numeric_date = this.dateTranslateService.parseCompleteDate(activityText, repostDate, flowType) || {
        days_ago: 0,
        hours_ago: 0,
        minutes_ago: 0,
      };

      const repostLinkSelector = ["a.tap-target", "a.update-components-mini-update-v2__link-to-details-page"];

      for (const selector of repostLinkSelector) {
        try {
          const element = await repost.findElement(By.css(selector));
          const href = await element.getAttribute("href");
          repostData.postUrl = StringUtils.removeSlashOnEnd(href);
          break;
        } catch {
        
        }
      }

      repostText = repostText.replaceAll("\nhashtag", "").replaceAll("\n#", "#").replaceAll("hashtag#", "#");
      postText = postText.replaceAll("\nhashtag", "").replaceAll("\n#", "#").replaceAll("hashtag#", "#");

      const postCategory: LinkedInPostResponseDto = {
        numeric_date: postNumericDate,
        type: Post.OriginType.REPOST_WITH_TEXT,
        activityType: ActivityType.POSTED_POST,
        post_data: postType,
        re_post_text: repostText,
        repost_data: repostData,
        original_post_text: postText,
        post_url: postUrl,
        like_count: likeCount,
      };

      return postCategory;
    } catch {
      let postText = "";
      try {
        const postTextElement = await post.findElements(
          By.css("div.update-components-text.relative.update-components-update-v2__commentary"),
        );

        if (postTextElement.length > 0) {
          postText = await postTextElement[0].getAttribute("innerText");
        }
      } catch {
        postText = "";
      }

      postText = postText.replaceAll("\nhashtag", "").replaceAll("\n#", "#").replaceAll("hashtag#", "#");

      const postCategory: LinkedInPostResponseDto = {
        numeric_date: postNumericDate,
        type: Post.OriginType.NEW_POST,
        activityType: ActivityType.POSTED_POST,
        post_data: postType,
        original_post_text: postText,
        post_url: postUrl,
        like_count: likeCount,
      };

      return postCategory;
    }
  }
  private async identifyPost(post: WebElement, driver: IWebDriverService): Promise<LinkedInPostResponseDto["post_data"]> {
    let postType: Post.PayloadType | undefined;
    let linkImage = "";
    let linkUrl = "";
    let linkCaption = "";
    const imageLinks: string[] = [];
    let articleCaption = "";
    const articleImages: string[] = [];
    let jobTitle = "";
    let jobDescription = "";

    try {
      const videoContainer = await post.findElement(By.css('[class="update-components-linkedin-video__container"]'));
      try {
        const eventSelectors = ["a[href*='/video/event/']", "a[href*='/video/live/']"];
        await WebDriverUtils.findElementBySelectors(videoContainer, eventSelectors);
        postType = undefined;
      } catch {
        postType = Post.PayloadType.TEXT_WITH_VIDEO;
      }
    } catch {
      try {

        try {
          await post.findElement(By.css(".update-components-celebration.text-align-center.feed-shared-update-v2__content"));
      
          postType = Post.PayloadType.TEXT_ONLY;
          try {
            const celebrationType = await (await post.findElement(By.css(".update-components-celebration__headline"))).getText();
            this.loggerService.log(`\n celebrationType: ${celebrationType}\n`);
          } catch {}
        } catch {
        }
        await post.findElement(By.css(".update-components-image__container"));
        postType = Post.PayloadType.TEXT_WITH_IMAGE;
        const elements = await post.findElements(
          By.css(".update-components-image__image-link .ivm-image-view-model .ivm-view-attr__img-wrapper.display-flex img"),
        );

        for (const e of elements) {
          const src = await e.getAttribute("src");
          if (!src.includes("data:image")) {
            imageLinks.push(src);
          }
        }

        // Если не удалась - пробуем еще 1 селектор
        if (imageLinks.length === 0) {
          const elements = await post.findElements(
            By.css(
              ".update-components-image__image-link .ivm-image-view-model .ivm-view-attr__img-wrapper.ivm-view-attr__img-wrapper--no-flex img",
            ),
          );

          for (const e of elements) {
            const src = await e.getAttribute("src");
            if (!src.includes("data:image")) {
              imageLinks.push(src);
            }
          }

          // Если не удались предыдущие - пробуем еще 1 селектор
          if (imageLinks.length === 0) {
            const elements = await post.findElements(
              By.css(".update-components-image__image-link .ivm-image-view-model .ivm-view-attr__img-wrapper img"),
            );

            for (const e of elements) {
              const src = await e.getAttribute("src");
              if (!src.includes("data:image")) {
                imageLinks.push(src);
              }
            }
          }
        }

        // Остальные кейсы
      } catch {
        // Текст с ссылкой
        try {
          await post.findElement(By.css(".update-components-article__link-container"));
          postType = Post.PayloadType.TEXT_WITH_LINK;
          linkUrl = await post.findElement(By.css(".update-components-article__link-container a")).getAttribute("href");
          try {
            linkImage = await post
              .findElement(By.css(".update-components-article__link-container a div.ivm-view-attr__img-wrapper img"))
              .getAttribute("src");

            if (linkImage.includes("data:image")) {
              linkImage = "";
            }
            try {
              linkCaption = await post.findElement(By.css(".update-components-article__title")).getText();
            } catch {
              linkCaption = "";
            }
          } catch {
            try {
              linkImage = await post.findElement(By.css(".update-components-article__link-container a img")).getAttribute("src");

              if (linkImage.includes("data:image")) {
                linkImage = "";
              }
              try {
                linkCaption = await post.findElement(By.css(".t-14.update-components-article__title.break-words.t-black.t-bold")).getText();
              } catch {
                linkCaption = "";
              }
            } catch {
              try {
                linkImage = await post
                  .findElement(By.css(".app-aware-link.update-components-article__image-link.tap-target div.ivm-image-view-model div img"))
                  .getAttribute("src");

                if (linkImage.includes("data:image")) {
                  linkImage = "";
                }
              } catch {
                try {
                  linkImage = await post
                    .findElement(By.css(".app-aware-link.tap-target .ivm-image-view-model .ivm-view-attr__img-wrapper img"))
                    .getAttribute("src");

                  if (linkImage.includes("data:image")) {
                    linkImage = "";
                  }
                } catch {
                  linkImage = "";
                }
              }
              try {
                linkCaption = await post.findElement(By.css(".t-14.update-components-article__title.break-words.t-black.t-bold")).getText();
              } catch {
                linkCaption = "";
              }
            }
          }
        } catch {
          try {
            await post.findElement(By.css(".update-components-article--with-no-image a"));
            postType = Post.PayloadType.TEXT_WITH_LINK;
            try {
              linkUrl = await post.findElement(By.css(".update-components-article--with-no-image a")).getAttribute("href");
              try {
                linkImage = await post
                  .findElement(By.css(".app-aware-link.update-components-article__image-link.tap-target div.ivm-image-view-model div img"))
                  .getAttribute("src");

                if (linkImage.includes("data:image")) {
                  linkImage = "";
                }
              } catch {
                linkImage = "";
              }
              try {
                linkCaption = await post.findElement(By.css(".t-14.update-components-article__title.break-words.t-black.t-bold")).getText();
              } catch {
                linkCaption = "";
              }
            } catch {
              try {
                linkCaption = await post.findElement(By.css(".t-14.update-components-article__title.break-words.t-black.t-bold")).getText();
              } catch {
                linkCaption = "";
              }
              linkUrl = "";
            }
          } catch {
            try {
              await post.findElement(By.css(".update-components-entity__content-wrapper"));
              const jobElement = await post.findElement(By.css(".update-components-entity__content-wrapper"));
              jobTitle = await jobElement.findElement(By.css(".update-components-entity__title.t-black.t-bold.t-14")).getText();
              jobDescription = (await Promise.all((await jobElement.findElements(By.css("h3"))).map(async (v) => await v.getText()))).join(
                " ",
              );
              postType = Post.PayloadType.TEXT_WITH_JOB_VACANCY;
            } catch {
              try {
                await post.findElement(By.css('h3[class="t-sans t-16 t-black t-bold mb1 break-words"]')).getText();
                postType = Post.PayloadType.TEXT_WITH_POLL;
    
                await Promise.all(
                  (await post.findElements(By.css(".update-components-poll-option__text-container"))).map(async (v) => await v.getText()),
                );
              } catch {
                try {
                  await post.findElement(
                    By.css(
                      ".update-components-document__container.update-components-document__container--top-bottom-border.feed-shared-update-v2__content",
                    ),
                  );
                  postType = Post.PayloadType.TEXT_WITH_ARTICLE;
                  try {
                    await driver.executeScript("arguments[0].scrollIntoView({ behavior: 'smooth', block: 'end' });", post);
                    await driver.wait(
                      until.elementLocated(
                        By.css(".document-s-container__document-element.document-s-container__document-element--loaded"),
                      ),
                      5000,
                    );

                    await FunctionUtils.sleepRandom(1400, 1800);
                    const iframe = await post.findElement(
                      By.css(".document-s-container__document-element.document-s-container__document-element--loaded"),
                    );
                    articleCaption = (await iframe.getAttribute("title")).split("for:")[1];
                    await driver.switchTo().frame(iframe);
                    const elements = await driver.findElements(By.css("ul.carousel-track li img"));

                    for (const e of elements) {
                      const src = await e.getAttribute("data-src");
                      if (!src.includes("data:image")) {
                        articleImages.push(src);
                      }
                    }

                    await driver.switchTo().defaultContent();
                  } catch {}
                } catch {
                  try {
                    await post.findElement(By.css(".document-s-container"));
                    postType = Post.PayloadType.TEXT_WITH_ARTICLE;
                    try {
                      await driver.executeScript("arguments[0].scrollIntoView({ behavior: 'smooth', block: 'end' });", post);
                      await driver.wait(
                        until.elementLocated(
                          By.css(".document-s-container__document-element.document-s-container__document-element--loaded"),
                        ),
                        5000,
                      );

                      await FunctionUtils.sleepRandom(1400, 1800);
                      const iframe = await post.findElement(
                        By.css(".document-s-container__document-element.document-s-container__document-element--loaded"),
                      );
                      articleCaption = (await iframe.getAttribute("title")).split("for:")[1];
                      await driver.switchTo().frame(iframe);
                      const elements = await driver.findElements(By.css("ul.carousel-track li img"));
                      for (const e of elements) {
                        const src = await e.getAttribute("data-src");
                        if (!src.includes("data:image")) {
                          articleImages.push(src);
                        }
                      }
                      await driver.switchTo().defaultContent();
                    } catch {}
                  } catch {
                    try {
                      await post.findElement(By.css(".update-components-text.relative.update-components-update-v2__commentary"));
                      postType = Post.PayloadType.TEXT_ONLY;
                    } catch {}
                    try {
                      const eventSelectors = [
                        ".ember-view.update-components-scheduled-live-content__event-link",
                        ".update-components-event__banner-link",
                      ];
                      await WebDriverUtils.findElementBySelectors(post, eventSelectors);
                      postType = undefined;
                    } catch {}
                  }
                }
              }
            }
          }
        }
      }
    }

    if (!postType) {
      this.loggerService.error("\nCould not determine post type or post type not supported\n");
      throw new Error("Could not determine post type  or post type not supported");
    }

    const postData: LinkedInPostResponseDto["post_data"] = {
      post_type: postType,
      image_links: imageLinks,
      article_caption: articleCaption,
      article_images: articleImages,
      link_caption: linkCaption,
      link_url: linkUrl,
      link_image: linkImage,
      job_title: jobTitle,
      job_description: jobDescription,
    };

    return postData;
  }

  private getPostUrl(postId: string): string {
    return POST_URL_TEMPLATES + postId;
  }

  private async getLikesCount(data: WebElement): Promise<string> {
    let likesCount = "";
    try {
      likesCount = await data.findElement(By.css(".social-details-social-counts__reactions-count")).getText();
    } catch {
      try {
        likesCount = await data.findElement(By.css(".social-details-social-counts__social-proof-fallback-number")).getText();
      } catch {
        likesCount = "";
      }
    }
    return likesCount;
  }

  private async openSeeMore(driver: IWebDriverService, post: WebElement): Promise<void> {
    await WebDriverUtils.waitRandomInterval("small");
    try {
      const seeMores = await post.findElements(
        By.css(
          "div.update-components-text.relative.update-components-update-v2__commentary + .feed-shared-inline-show-more-text__see-more-less-toggle.see-more.t-14.t-black--light.t-normal.hoverable-link-text",
        ),
      );
    
      for (const seeMore of seeMores) {
        try {
          await WebDriverUtils.performCustomClick(driver, seeMore);
          await FunctionUtils.sleepRandom(900, 1100);
        } catch {
  
        }
      }
    } catch {
    }
  }
/* Demo fragment ended. Rest of the code can be requested during the intreview process */
