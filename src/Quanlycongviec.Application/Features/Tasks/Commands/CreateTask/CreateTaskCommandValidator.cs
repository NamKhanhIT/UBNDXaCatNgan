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
            RuleFor(x => x.EstimatedEffortHours).GreaterThan(0);
        }
    }
}
