import { toggleCommentReaction, type CommentReactionRouteContext } from '../reaction';

export async function PATCH(request: Request, context: CommentReactionRouteContext) {
  return toggleCommentReaction(request, context, 'like');
}
