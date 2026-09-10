using FluentValidation;

namespace Quanlycongviec.Application.Features.Tasks.Commands.CreateTask
{
    public class CreateTaskCommandValidator : AbstractValidator<CreateTaskCommand>
    {
        public CreateTaskCommandValidator()
        {
            RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
            RuleFor(x => x.AssignerId).NotEmpty();
            RuleFor(x => x.AssigneeId).NotEmpty();
            // BẢO MẬT (Audit 04-09-2026): Không cho phép tự giao việc cho chính mình theo quy chuẩn hành chính.
            RuleFor(x => x.AssigneeId)
                .NotEqual(x => x.AssignerId)
                .WithMessage("Không thể tự giao việc cho chính mình theo quy chuẩn hành chính.");
        }
    }
}
